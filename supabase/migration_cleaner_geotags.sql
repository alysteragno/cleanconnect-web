-- Per-cleaner geotags, captured at the two existing checkpoint events (no
-- continuous/real-time tracking): "Start Trip" and "I've Arrived" in the
-- cleaner mobile app (app/(cleaner)/jobs/[id].tsx).
--
-- Lives on cleaner_assignments rather than bookings so a booking needing
-- multiple cleaners gets one geotag pair per cleaner instead of a single
-- shared value. Previously the mobile app wrote the "start trip" GPS fix
-- into profiles.home_lat/home_lng — the same columns the admin's "Pin Home
-- Location" feature uses for a static home address — silently overwriting
-- it on every trip start. profiles.home_lat/lng is no longer touched by the
-- trip-start flow; these are properly separate.
--
-- Nullable throughout — a cleaner may not have started/arrived yet, and
-- everything that reads these already degrades gracefully when null
-- (falls back to the customer's service_lat/lng or a haversine estimate).
ALTER TABLE cleaner_assignments
  ADD COLUMN IF NOT EXISTS en_route_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS en_route_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS en_route_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrived_lat  NUMERIC,
  ADD COLUMN IF NOT EXISTS arrived_lng  NUMERIC,
  ADD COLUMN IF NOT EXISTS arrived_at   TIMESTAMPTZ;
