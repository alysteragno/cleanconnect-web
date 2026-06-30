-- Add notes (cleaner free-text) and updated_at (auto-timestamp) to cleaner_day_off_requests.
-- Run in the Supabase SQL Editor AFTER migration_cleaner_day_off_requests.sql.

-- ── New columns ────────────────────────────────────────────────────────────
ALTER TABLE cleaner_day_off_requests
  ADD COLUMN IF NOT EXISTS notes       TEXT,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── Auto-update trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_day_off_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_day_off_updated_at ON cleaner_day_off_requests;
CREATE TRIGGER trg_day_off_updated_at
  BEFORE UPDATE ON cleaner_day_off_requests
  FOR EACH ROW EXECUTE FUNCTION set_day_off_updated_at();
