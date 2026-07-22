-- Run this in the Supabase SQL Editor.
-- Cleaner resignation request workflow: a cleaner submits a request from the
-- mobile app instead of being able to deactivate/delete their own account
-- directly. A super_admin reviews and Approves or Rejects it (web admin UI
-- is separate, follow-up work — this migration only lays the groundwork).
-- Nothing is ever hard-deleted: approval only flips status columns on
-- profiles, so booking/payment/rating history for the cleaner stays intact.

-- ── Status type ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE resignation_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Main table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cleaner_resignation_requests (
    id           UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id   UUID                NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reason       TEXT,
    status       resignation_status  NOT NULL DEFAULT 'pending',
    admin_note   TEXT,
    reviewed_by  UUID                REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Only one open (pending) resignation request per cleaner at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_resignation_one_pending_per_cleaner
    ON cleaner_resignation_requests (cleaner_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS resignation_requests_cleaner_id_idx
    ON cleaner_resignation_requests (cleaner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS resignation_requests_status_idx
    ON cleaner_resignation_requests (status);

-- ── Row-Level Security ─────────────────────────────────────────────────────
ALTER TABLE cleaner_resignation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cleaners can view own resignation requests"      ON cleaner_resignation_requests;
DROP POLICY IF EXISTS "Cleaners can submit resignation requests"        ON cleaner_resignation_requests;
DROP POLICY IF EXISTS "Cleaners can delete pending resignation requests" ON cleaner_resignation_requests;
DROP POLICY IF EXISTS "Super admins manage all resignation requests"    ON cleaner_resignation_requests;

-- Cleaners: read their own requests
CREATE POLICY "Cleaners can view own resignation requests"
    ON cleaner_resignation_requests FOR SELECT
    TO authenticated
    USING (cleaner_id = auth.uid());

-- Cleaners: submit new requests. cleaner_id must equal their own uid and
-- status must be 'pending' — a cleaner can never insert a pre-approved row.
CREATE POLICY "Cleaners can submit resignation requests"
    ON cleaner_resignation_requests FOR INSERT
    TO authenticated
    WITH CHECK (
        cleaner_id = auth.uid()
        AND status = 'pending'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'cleaner'
        )
    );

-- Cleaners: cancel/delete their own PENDING requests only — once an admin
-- has reviewed it, the row stays put as the audit trail.
CREATE POLICY "Cleaners can delete pending resignation requests"
    ON cleaner_resignation_requests FOR DELETE
    TO authenticated
    USING (
        cleaner_id = auth.uid()
        AND status = 'pending'
    );

-- Super admins: full access (read, approve/reject, delete).
CREATE POLICY "Super admins manage all resignation requests"
    ON cleaner_resignation_requests FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ── Real-time (idempotent) ─────────────────────────────────────────────────
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE cleaner_resignation_requests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Employment / account status on profiles ─────────────────────────────────
-- Explicit vocabulary for the future web approval action to set. Kept
-- alongside the existing is_active/deactivated_at pair (already wired into
-- the AI dispatch pool filter in src/lib/ai-assignment.ts and the mobile
-- login deactivation check in app/(auth)/login.tsx) rather than replacing
-- it — the approval action must set BOTH pairs together so nothing drifts
-- out of sync:
--   employment_status = 'resigned'
--   account_status    = 'inactive'
--   is_active         = false            (existing column)
--   deactivated_at    = NOW()            (existing column)
-- and on the request row: status = 'approved', reviewed_by = <admin id>,
-- reviewed_at = NOW(). Rejecting only touches the request row (status =
-- 'rejected', admin_note, reviewed_by, reviewed_at) — the cleaner's profile
-- is untouched either way. No row is ever hard-deleted by this workflow.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS employment_status TEXT NOT NULL DEFAULT 'active'
    CHECK (employment_status IN ('active', 'resigned')),
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'inactive'));
