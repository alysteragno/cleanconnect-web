-- CleanConnect Phase 7 Migration
-- Run this in the Supabase SQL Editor before the admin dashboard

-- 1. Add is_active to profiles for soft-deactivation of cleaners
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Super admins can insert profiles (needed to create cleaner accounts)
CREATE POLICY "Super admins can insert profiles"
ON profiles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- 3. Super admins can update any profile (edit cleaners, change branch, deactivate)
CREATE POLICY "Super admins can update any profile"
ON profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);
