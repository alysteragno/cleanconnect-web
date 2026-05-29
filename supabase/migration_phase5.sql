-- CleanConnect Phase 5 Migration
-- Run this in the Supabase SQL Editor before the cleaner dashboard

-- 1. Add started_at to cleaner_assignments (records when cleaner taps "Start Job")
ALTER TABLE cleaner_assignments
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- 2. Allow cleaners to update booking status for assignments they own
--    Covers both 'offered' (for accept flow) and 'accepted' (for start/complete flow)
CREATE POLICY "Cleaners can update status of their assigned bookings"
ON bookings FOR UPDATE
USING (
  id IN (
    SELECT booking_id FROM cleaner_assignments
    WHERE cleaner_id = auth.uid()
      AND status IN ('offered', 'accepted')
  )
);
