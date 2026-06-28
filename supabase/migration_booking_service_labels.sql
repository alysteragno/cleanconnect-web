-- migration_booking_service_labels.sql
-- 1. Remove service_type from services table
-- 2. Add service_name to bookings, backfill from service_type slug
-- 3. Recreate service_ratings view using service_name
-- 4. Drop service_type from bookings

ALTER TABLE services DROP COLUMN IF EXISTS service_type;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_name TEXT;

UPDATE bookings
SET service_name = CASE service_type
  WHEN 'general'           THEN 'General Cleaning'
  WHEN 'premium_mattress'  THEN 'Premium Mattress Clean'
  WHEN 'complete'          THEN 'Complete Home Cleaning'
  WHEN 'disinfection'      THEN 'Disinfection & Sanitization'
  WHEN 'post_construction' THEN 'Post-Construction Cleaning'
  ELSE service_type
END
WHERE service_name IS NULL;

-- Recreate view using service_name before dropping service_type
DROP VIEW IF EXISTS service_ratings;

CREATE VIEW service_ratings AS
SELECT
  b.service_name,
  ROUND(AVG(f.rating)::numeric, 1) AS avg_rating,
  COUNT(f.id)::integer              AS review_count
FROM feedback f
JOIN bookings b ON b.id = f.booking_id
GROUP BY b.service_name;

ALTER TABLE bookings DROP COLUMN IF EXISTS service_type;
