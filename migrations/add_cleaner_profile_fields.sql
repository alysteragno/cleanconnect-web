-- Run this in Supabase SQL Editor
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS address_street           TEXT,
  ADD COLUMN IF NOT EXISTS address_city             TEXT,
  ADD COLUMN IF NOT EXISTS address_province         TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth            DATE,
  ADD COLUMN IF NOT EXISTS emergency_contact_name   TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone  TEXT;
