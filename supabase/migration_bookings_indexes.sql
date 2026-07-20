-- Supports the admin bookings list's period-tab filtering (Past 3 Days,
-- This Week, Next Month, …) and status chips, which now query by date range
-- and status directly instead of loading every booking row — see
-- src/app/(dashboard)/admin/bookings/page.tsx.
CREATE INDEX IF NOT EXISTS idx_bookings_service_date ON bookings (service_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at   ON bookings (created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status        ON bookings (status);
