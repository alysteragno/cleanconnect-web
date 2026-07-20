-- Reconciles a discrepancy found between this repo's two RLS source files:
-- rls.sql has a "Users can update own profile" policy (auth.uid() = id), but
-- schema.sql — the more recently touched, nominally canonical "run this on a
-- fresh project" file — does NOT. If schema.sql (not rls.sql) is what
-- actually matches the live database, a user's own-row profiles UPDATE
-- (including the cleaner mobile app's push_token registration on login, and
-- the new last_seen_lat/lng/at ping in app/(cleaner)/_layout.tsx) would be
-- silently blocked by RLS — Supabase returns 0 rows affected with no thrown
-- error, so this class of failure is otherwise invisible.
--
-- DROP + CREATE (not a plain CREATE) so this is safe to run whether or not
-- the policy already exists live — Postgres has no CREATE POLICY IF NOT
-- EXISTS.
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
