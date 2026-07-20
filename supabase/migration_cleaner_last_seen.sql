-- Opportunistic "last seen" location for cleaners — captured when the cleaner
-- app is foregrounded (see app/(cleaner)/_layout.tsx in cleanconnect-mobile),
-- NOT via a background timer/task. This is a freshness layer on top of the
-- two existing checkpoints (cleaner_assignments.en_route_lat/lng,
-- .arrived_lat/lng, added in migration_cleaner_geotags.sql): those only exist
-- once a cleaner has an active job, so AI dispatch had no better-than-the-
-- business-office guess for an idle cleaner's location. Deliberately
-- separate from profiles.home_lat/lng (the admin-set static home address —
-- do not conflate the two, that was the original bug this whole geotag
-- effort started from).
--
-- Nullable — a cleaner who has never opened the updated app version, or
-- denied location permission, simply has no last_seen data, and callers
-- (src/lib/ai-assignment.ts) fall back further to home_lat/lng, then the
-- business office.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS last_seen_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS last_seen_at  TIMESTAMPTZ;
