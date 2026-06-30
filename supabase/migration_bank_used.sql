-- Add bank_used to bookings so the mobile can record which specific bank
-- the customer transferred to when payment_method = 'bank_transfer'.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS bank_used TEXT;
