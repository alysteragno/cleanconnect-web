-- Prevent the same customer from being booked twice into the exact same
-- service_date + service_time at the DB level (not just in application
-- code) — a partial unique index, so a cancelled booking doesn't block
-- rebooking that same slot.
--
-- Run in Supabase SQL Editor.
--
-- ── BEFORE YOU RUN THIS ──────────────────────────────────────────────────
-- A UNIQUE index is checked against ALL existing rows at creation time and
-- will fail to install if a duplicate already exists. Run this diagnostic
-- first and resolve any rows it returns (cancel or reschedule one of each
-- duplicate pair) before running the CREATE UNIQUE INDEX below:
--
--   SELECT customer_id, service_date, service_time, array_agg(id) AS booking_ids
--     FROM bookings
--    WHERE status <> 'cancelled'
--    GROUP BY customer_id, service_date, service_time
--   HAVING COUNT(*) > 1;
--
-- (As of this writing, one customer has 3 non-cancelled bookings stacked on
-- the same 2026-07-21 08:00 slot — the same test data already flagged by
-- migration_prevent_double_booking.sql's diagnostic. Resolve that first.)
-- ─────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_customer_no_double_booking
  ON bookings (customer_id, service_date, service_time)
  WHERE status <> 'cancelled';
