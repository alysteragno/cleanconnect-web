-- Run this in the Supabase SQL Editor.
-- Cleaner day-off request workflow: cleaners submit requests,
-- super_admin approves or rejects. Approved requests auto-populate
-- cleaner_availability so the scheduling system sees the block.

-- ── Status type ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE day_off_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Main table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cleaner_day_off_requests (
    id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id     UUID           NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    requested_date DATE           NOT NULL,
    reason         TEXT,
    status         day_off_status NOT NULL DEFAULT 'pending',
    admin_notes    TEXT,
    reviewed_by    UUID           REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    -- one request per cleaner per date; duplicate dates are rejected at DB level
    CONSTRAINT uq_day_off_cleaner_date UNIQUE (cleaner_id, requested_date)
);

CREATE INDEX IF NOT EXISTS day_off_requests_cleaner_id_idx
    ON cleaner_day_off_requests (cleaner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS day_off_requests_status_idx
    ON cleaner_day_off_requests (status, requested_date);

-- ── Row-Level Security ─────────────────────────────────────────────────────
ALTER TABLE cleaner_day_off_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cleaners can view own day-off requests"   ON cleaner_day_off_requests;
DROP POLICY IF EXISTS "Cleaners can submit day-off requests"     ON cleaner_day_off_requests;
DROP POLICY IF EXISTS "Cleaners can delete pending requests"     ON cleaner_day_off_requests;
DROP POLICY IF EXISTS "Super admins manage all day-off requests" ON cleaner_day_off_requests;

-- Cleaners: read their own requests
CREATE POLICY "Cleaners can view own day-off requests"
    ON cleaner_day_off_requests FOR SELECT
    TO authenticated
    USING (cleaner_id = auth.uid());

-- Cleaners: submit new requests (cleaner_id must equal own uid, status defaults to pending)
CREATE POLICY "Cleaners can submit day-off requests"
    ON cleaner_day_off_requests FOR INSERT
    TO authenticated
    WITH CHECK (
        cleaner_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'cleaner'
        )
    );

-- Cleaners: cancel/delete their own PENDING requests only
CREATE POLICY "Cleaners can delete pending requests"
    ON cleaner_day_off_requests FOR DELETE
    TO authenticated
    USING (
        cleaner_id = auth.uid()
        AND status = 'pending'
    );

-- Super admins: full access (read, update status, delete)
CREATE POLICY "Super admins manage all day-off requests"
    ON cleaner_day_off_requests FOR ALL
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
    ALTER PUBLICATION supabase_realtime ADD TABLE cleaner_day_off_requests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
