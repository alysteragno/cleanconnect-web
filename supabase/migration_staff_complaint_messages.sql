-- Run this in the Supabase SQL Editor.
-- Staff (super_admin) replies on complaints go here;
-- customer messages stay in complaint_messages.

CREATE TABLE IF NOT EXISTS staff_complaint_messages (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID        NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    sender_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message      TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS staff_complaint_messages_complaint_id_idx
  ON staff_complaint_messages (complaint_id, created_at DESC);

ALTER TABLE staff_complaint_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scm_customer_read" ON staff_complaint_messages;
DROP POLICY IF EXISTS "scm_staff_access"  ON staff_complaint_messages;

-- Customers: read-only access to staff replies on their own complaints.
CREATE POLICY "scm_customer_read"
  ON staff_complaint_messages FOR SELECT
  TO authenticated
  USING (
    complaint_id IN (
      SELECT id FROM complaints WHERE customer_id = auth.uid()
    )
  );

-- Staff: full read/write access to every complaint thread.
CREATE POLICY "scm_staff_access"
  ON staff_complaint_messages FOR ALL
  TO authenticated
  USING  (auth_user_role() = 'super_admin')
  WITH CHECK (auth_user_role() = 'super_admin');

-- Allow real-time subscriptions (idempotent).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE staff_complaint_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
