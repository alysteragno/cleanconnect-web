-- CleanConnect Phase 4 Migration
-- Run this in the Supabase SQL Editor before starting the customer portal

-- 1. Add new columns to bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS address_unit TEXT,
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_province TEXT,
  ADD COLUMN IF NOT EXISTS space_type TEXT DEFAULT 'residential',
  ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS special_notes TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';

-- 2. Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cleaner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(booking_id)
);

-- 3. Enable RLS on feedback
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- 4. Feedback RLS policies
CREATE POLICY "Customers can submit feedback for their completed bookings"
ON feedback FOR INSERT
WITH CHECK (
  customer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM bookings
    WHERE id = booking_id
      AND customer_id = auth.uid()
      AND status = 'completed'
  )
);

CREATE POLICY "Authenticated users can read feedback"
ON feedback FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Super admins have full access to feedback"
ON feedback FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);
