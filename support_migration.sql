-- Run this in the Supabase SQL Editor to enable the Support Chat feature.

CREATE TABLE IF NOT EXISTS direct_messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS direct_messages_customer_id_idx
  ON direct_messages (customer_id, created_at DESC);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Helper: reads the caller's role without recursing into profiles RLS.
-- SECURITY DEFINER runs as postgres (superuser), bypassing row-level security
-- on the profiles table, which would otherwise cause infinite policy recursion.
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Drop any previous version of these policies before recreating.
DROP POLICY IF EXISTS "customer_own_support_thread" ON direct_messages;
DROP POLICY IF EXISTS "staff_all_support_threads"   ON direct_messages;
DROP POLICY IF EXISTS "dm_customer_access"          ON direct_messages;
DROP POLICY IF EXISTS "dm_staff_access"             ON direct_messages;

-- Customers: read and write only their own thread, only as themselves.
CREATE POLICY "dm_customer_access"
  ON direct_messages FOR ALL
  TO authenticated
  USING  (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid() AND sender_id = auth.uid());

-- Staff (super_admin, branch_manager): full read/write access to every thread.
CREATE POLICY "dm_staff_access"
  ON direct_messages FOR ALL
  TO authenticated
  USING  (auth_user_role() IN ('super_admin', 'branch_manager'))
  WITH CHECK (auth_user_role() IN ('super_admin', 'branch_manager'));

-- Allow real-time subscriptions on this table.
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
