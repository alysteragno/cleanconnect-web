-- Records when a cleaner marks themselves as "on the way" in the mobile app.
-- Used by admin to determine if a ₱200 transportation fee applies on customer cancellation.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cleaner_en_route_at TIMESTAMPTZ;
