-- CleanConnect Phase 6 Migration
-- Run this in the Supabase SQL Editor before the manager dashboard

-- 1. Cleaner availability / day-offs table
--    Used by the manager to see who's unavailable,
--    and by the Phase 8 AI engine to filter ineligible cleaners.
CREATE TABLE IF NOT EXISTS cleaner_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  unavailable_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cleaner_id, unavailable_date)
);

ALTER TABLE cleaner_availability ENABLE ROW LEVEL SECURITY;

-- Cleaners manage their own day-offs
CREATE POLICY "Cleaners can manage their own availability"
ON cleaner_availability FOR ALL
USING (cleaner_id = auth.uid());


-- Super admins have full access
CREATE POLICY "Super admins have full access to cleaner availability"
ON cleaner_availability FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- 2. Store lat/lng on bookings and profiles for the Phase 8 proximity ranking.
--    Nullable — the AI falls back to workload-only ranking when absent.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS service_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS service_lng NUMERIC;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS home_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS home_lng NUMERIC;
