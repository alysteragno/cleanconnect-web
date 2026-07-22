-- Tracks when a profile (cleaner or customer) was last deactivated, so the
-- cleaners archive/history view can show "deactivated on <date>" instead of
-- just a boolean. NULL while active; cleared back to NULL on reactivation.
--
-- Run in Supabase SQL Editor.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
