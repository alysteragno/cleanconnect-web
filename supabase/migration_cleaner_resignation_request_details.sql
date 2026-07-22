-- Run in Supabase SQL Editor.
-- Follow-up to migration_cleaner_resignation_requests.sql. Rounds the request
-- out with the fields a resignation actually needs:
--   - notes: required free-text elaboration, kept separate from the
--     structured reason category — mirrors the reason/notes split already
--     used by cleaner_day_off_requests (reason = a picked label, notes =
--     free text).
--   - acknowledged: the cleaner confirmed, before submitting, that this is
--     only a request and that resignation is finalized in person at the
--     business office — not a checkbox that's merely validated client-side,
--     enforced with a CHECK constraint so no insert path can ever skip it.
--
-- 'reason' already exists (added in migration_cleaner_resignation_requests.sql
-- as free TEXT) — from here on the mobile app writes a short category label
-- into it, picked from a fixed set of pills (e.g. "Relocation", "Better
-- Opportunity", ...), the same "label string, no DB enum" approach already
-- used by cleaner_day_off_requests.reason.
--
-- Both reason and notes are REQUIRED (not optional — an earlier version of
-- this feature made them optional, since revised). The table has no rows
-- yet, so tightening these to NOT NULL + non-blank here is safe. There is no
-- proposed-last-working-day field — that was considered and removed before
-- shipping; a last day is decided in person at the business office instead.

ALTER TABLE cleaner_resignation_requests
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE cleaner_resignation_requests
  ALTER COLUMN reason SET NOT NULL,
  ALTER COLUMN notes SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE cleaner_resignation_requests
    ADD CONSTRAINT chk_resignation_reason_notes_not_blank
    CHECK (length(trim(reason)) > 0 AND length(trim(notes)) > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE cleaner_resignation_requests
    ADD CONSTRAINT chk_resignation_acknowledged CHECK (acknowledged = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
