-- Run this in the Supabase SQL Editor.
-- Support conversation archiving --------------------------------------------
-- Support threads have no single row of their own (they're just customer_id-
-- scoped messages spread across direct_messages/admin_messages), so
-- conversation-level state lives here instead.
--
-- `archived_at`  — set when an admin manually archives the conversation.
-- `restored_at`  — set when an admin manually restores it; used as a fresh
--                  activity baseline so a restore isn't immediately swept
--                  back into Archived by the inactivity rule (see
--                  SUPPORT_AUTO_ARCHIVE_DAYS in src/utils/chat-helpers.ts).
--
-- Conversations with no row here, or with archived_at NULL, are active unless
-- they've been inactive longer than the auto-archive window (computed at
-- read time — no scheduled job needed).

CREATE TABLE IF NOT EXISTS support_conversations (
    customer_id UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    archived_at TIMESTAMPTZ,
    restored_at TIMESTAMPTZ
);

ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sc_staff_access" ON support_conversations;

-- Staff (super_admin) only — customers don't need visibility into archive state.
CREATE POLICY "sc_staff_access"
  ON support_conversations FOR ALL
  TO authenticated
  USING  (auth_user_role() = 'super_admin')
  WITH CHECK (auth_user_role() = 'super_admin');
