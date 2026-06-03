-- CleanConnect Phase 8 Migration
-- Announcements table for marketing homepage

CREATE TABLE IF NOT EXISTS announcements (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  body        text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER bypasses RLS when reading profiles, preventing the
-- "infinite recursion in policy for relation profiles" error that occurs
-- when an RLS policy on table A queries table B whose own RLS also queries A.
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- Drop and recreate policies so this file is safe to re-run
DROP POLICY IF EXISTS "Public can read active announcements"  ON announcements;
DROP POLICY IF EXISTS "Super admins can manage announcements" ON announcements;

-- Public can read active announcements (shown on homepage)
CREATE POLICY "Public can read active announcements"
ON announcements FOR SELECT
USING (is_active = true);

-- Super admins can do everything
CREATE POLICY "Super admins can manage announcements"
ON announcements FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());
