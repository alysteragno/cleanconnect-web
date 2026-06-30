-- Run this in the Supabase SQL Editor.
-- Two-table support chat:
--   admin_messages  — staff → customer replies
--   direct_messages — customer → staff messages

-- ── admin_messages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_messages_customer_id_idx
  ON admin_messages (customer_id, created_at DESC);

ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "am_customer_read"  ON admin_messages;
DROP POLICY IF EXISTS "am_staff_access"   ON admin_messages;

-- Customers can read staff replies in their own thread.
CREATE POLICY "am_customer_read"
  ON admin_messages FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

-- Staff: full read/write.
CREATE POLICY "am_staff_access"
  ON admin_messages FOR ALL
  TO authenticated
  USING  (auth_user_role() = 'super_admin')
  WITH CHECK (auth_user_role() = 'super_admin');

-- ── direct_messages ────────────────────────────────────────────────────────
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

DROP POLICY IF EXISTS "dm_customer_access" ON direct_messages;
DROP POLICY IF EXISTS "dm_staff_read"      ON direct_messages;

-- Customers: read/write their own messages.
CREATE POLICY "dm_customer_access"
  ON direct_messages FOR ALL
  TO authenticated
  USING  (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- Staff: read-only access to all customer messages.
CREATE POLICY "dm_staff_read"
  ON direct_messages FOR SELECT
  TO authenticated
  USING (auth_user_role() = 'super_admin');

-- ── Real-time (idempotent) ─────────────────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE admin_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
