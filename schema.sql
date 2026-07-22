-- ─────────────────────────────────────────────────────────────────────────────
-- CleanConnect — Complete Database Schema
-- Maid For You Cleaning Services | BS-IT Capstone | FEU Institute of Technology
--
-- Run this entire file in the Supabase SQL Editor on a fresh project.
-- After running this, run seed.sql to create the first super admin account.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ENUMS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('super_admin', 'cleaner', 'customer');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('unpaid', 'partial', 'paid', 'refunded');
CREATE TYPE assignment_status AS ENUM ('assigned', 'declined', 'completed');


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABLES  (in foreign-key dependency order)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE profiles (
    id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role        user_role   NOT NULL DEFAULT 'customer',
    full_name   TEXT        NOT NULL,
    phone       TEXT,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    -- When a cleaner (or customer) was last deactivated; NULL while active.
    -- Cleared back to NULL on reactivation — powers the cleaners archive
    -- history view (src/app/(dashboard)/admin/cleaners/archive/page.tsx).
    deactivated_at TIMESTAMPTZ,
    home_lat    NUMERIC,
    home_lng    NUMERIC,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bookings (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         UUID            NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    service_type        TEXT            NOT NULL DEFAULT 'general',
    space_type          TEXT            NOT NULL DEFAULT 'residential',
    service_date        DATE            NOT NULL,
    service_time        TIME            NOT NULL,
    property_sqm        NUMERIC         NOT NULL,
    required_cleaners   INTEGER         NOT NULL DEFAULT 2,  -- set by admin; default 2–3 per policy
    duration_hours      NUMERIC,                             -- set by trigger
    base_price          NUMERIC,                             -- set by trigger
    couch_quantity      INTEGER         NOT NULL DEFAULT 0,
    mattress_quantity   INTEGER         NOT NULL DEFAULT 0,
    cancellation_fee    NUMERIC,                             -- transport cost only, set on cancellation
    status              booking_status  NOT NULL DEFAULT 'pending',
    payment_status      payment_status  NOT NULL DEFAULT 'unpaid',
    payment_method      TEXT            NOT NULL DEFAULT 'cash',
    bank_used           TEXT,
    address_unit        TEXT,
    address_street      TEXT,
    address_city        TEXT,
    address_province    TEXT,
    service_lat         NUMERIC,
    service_lng         NUMERIC,
    special_notes       TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Needed for the EXCLUDE constraint below (equality column + range column
-- in one GiST index).
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE cleaner_assignments (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id      UUID                NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    cleaner_id      UUID                NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status          assignment_status   NOT NULL DEFAULT 'offered',
    assigned_at     TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    -- [service start - 2h, service end + 2h), synced from bookings by
    -- trigger_sync_cleaner_assignment_window below (section 3c).
    schedule_window TSRANGE,
    UNIQUE(booking_id, cleaner_id),
    -- No two 'assigned' rows for the same cleaner may have overlapping
    -- windows — the DB-level guarantee behind the app's own conflict checks
    -- in dispatchCleaners / forceAssignCleaner / confirmAIDispatch.
    EXCLUDE USING gist (cleaner_id WITH =, schedule_window WITH &&) WHERE (status = 'assigned')
);

CREATE TABLE cleaner_availability (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    unavailable_date DATE        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(cleaner_id, unavailable_date)
);

CREATE TABLE feedback (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id  UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    customer_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    cleaner_id  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
    rating      INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(booking_id)
);

CREATE TABLE complaints (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    booking_id     UUID        REFERENCES bookings(id) ON DELETE SET NULL,
    -- Human-readable sequential reference, displayed as "CMP-000123"
    -- (src/lib/complaint-ticket.ts) — a bank-queue-style ticket number so
    -- admins/customers can reference a complaint without its UUID.
    ticket_number  SERIAL      UNIQUE,
    subject        TEXT        NOT NULL,
    status         TEXT        NOT NULL DEFAULT 'open',   -- open | in_progress | resolved
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title        TEXT        NOT NULL,
    body         TEXT        NOT NULL,
    type         TEXT        NOT NULL,
    booking_id   UUID        REFERENCES bookings(id) ON DELETE CASCADE,
    complaint_id UUID        REFERENCES complaints(id) ON DELETE CASCADE,
    is_read      BOOLEAN     NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE complaint_messages (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID        NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    sender_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message      TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE settings (
    key        TEXT        PRIMARY KEY,
    value      TEXT        NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. BUSINESS LOGIC TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- Auto-calculates duration_hours, base_price, and required_cleaners from property_sqm.
-- Trigger fires only on INSERT or UPDATE OF property_sqm, so a direct admin
-- UPDATE of required_cleaners is never overwritten (override preserved).
CREATE OR REPLACE FUNCTION apply_cleanconnect_operational_rules()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.property_sqm <= 30 THEN
        NEW.duration_hours    := 2.0;
        NEW.base_price        := 1000.00;
        NEW.required_cleaners := 1;
    ELSIF NEW.property_sqm <= 60 THEN
        NEW.duration_hours    := 3.0;
        NEW.base_price        := 1800.00;
        NEW.required_cleaners := 2;
    ELSIF NEW.property_sqm <= 100 THEN
        NEW.duration_hours    := 4.0;
        NEW.base_price        := 2500.00;
        NEW.required_cleaners := 3;
    ELSE
        NEW.duration_hours    := 4.0 + CEIL((NEW.property_sqm - 100) / 50.0);
        NEW.base_price        := 2500.00 + (CEIL((NEW.property_sqm - 100) / 50.0) * 800.00);
        NEW.required_cleaners := 3 + CEIL((NEW.property_sqm - 100) / 50.0)::INTEGER;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_operational_rules
BEFORE INSERT OR UPDATE OF property_sqm ON bookings
FOR EACH ROW EXECUTE FUNCTION apply_cleanconnect_operational_rules();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3b. DOUBLE-BOOKING PREVENTION (cleaner_assignments.schedule_window)
-- ─────────────────────────────────────────────────────────────────────────────
-- Keeps schedule_window (declared on cleaner_assignments above) in sync with
-- its booking's service_date/service_time/duration_hours, so the EXCLUDE
-- constraint on that column always reflects the real schedule. Mirrors the
-- ±2h conflict buffer in src/lib/ai-assignment.ts hasTimeConflict().
CREATE OR REPLACE FUNCTION sync_cleaner_assignment_window()
RETURNS TRIGGER AS $$
DECLARE
    b RECORD;
    start_ts TIMESTAMP;
    end_ts   TIMESTAMP;
BEGIN
    SELECT service_date, service_time, duration_hours INTO b
      FROM bookings WHERE id = NEW.booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found for cleaner_assignments row', NEW.booking_id;
    END IF;

    start_ts := (b.service_date + b.service_time) - INTERVAL '120 minutes';
    end_ts   := (b.service_date + b.service_time)
                + make_interval(mins => (COALESCE(b.duration_hours, 2) * 60)::int)
                + INTERVAL '120 minutes';

    -- Half-open range so back-to-back slots that only touch at the boundary
    -- don't count as a conflict — matches hasTimeConflict's strict '<'/'>'.
    NEW.schedule_window := tsrange(start_ts, end_ts, '[)');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_cleaner_assignment_window
BEFORE INSERT OR UPDATE ON cleaner_assignments
FOR EACH ROW EXECUTE FUNCTION sync_cleaner_assignment_window();

-- If a booking's own schedule changes after a cleaner is already assigned,
-- refresh the dependent assignment rows so schedule_window (and the
-- constraint) stay accurate. (No reschedule UI exists in the app today, but
-- this keeps the constraint correct if one is added later, or against a
-- direct DB edit.)
CREATE OR REPLACE FUNCTION resync_dependent_cleaner_assignment_windows()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE cleaner_assignments SET status = status WHERE booking_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_resync_cleaner_assignment_windows
AFTER UPDATE OF service_date, service_time, duration_hours ON bookings
FOR EACH ROW EXECUTE FUNCTION resync_dependent_cleaner_assignment_windows();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3c. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
-- Admin bookings list filters/sorts by these columns per request (period tabs
-- + status chips) instead of loading the whole table — see
-- src/app/(dashboard)/admin/bookings/page.tsx.
CREATE INDEX IF NOT EXISTS idx_bookings_service_date ON bookings (service_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at   ON bookings (created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status        ON bookings (status);

-- Prevents the same customer from being double-booked into the exact same
-- date + time slot. Partial (WHERE status <> 'cancelled') so a cancelled
-- booking never blocks rebooking that same slot.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_customer_no_double_booking
  ON bookings (customer_id, service_date, service_time)
  WHERE status <> 'cancelled';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaner_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaner_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback            ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_messages  ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins read all profiles"
    ON profiles FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

CREATE POLICY "Super admins can insert profiles"
    ON profiles FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

CREATE POLICY "Super admins can update any profile"
    ON profiles FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- Missing from this file until migration_profiles_self_update_rls.sql — a
-- plain user's own-row UPDATE (push_token registration on login, the
-- cleaner app's last_seen_lat/lng/at ping, profile edits, etc.) needs this;
-- without it only super_admin can UPDATE any profiles row at all.
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id);

-- bookings
CREATE POLICY "Customers manage own bookings"
    ON bookings FOR ALL USING (auth.uid() = customer_id);

CREATE POLICY "Staff read all bookings"
    ON bookings FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'cleaner'))
    );

CREATE POLICY "Admins update any booking"
    ON bookings FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- cleaner_assignments
CREATE POLICY "Cleaners read own assignments"
    ON cleaner_assignments FOR SELECT USING (auth.uid() = cleaner_id);

CREATE POLICY "Cleaners update own assignments"
    ON cleaner_assignments FOR UPDATE USING (auth.uid() = cleaner_id);

CREATE POLICY "Staff manage all assignments"
    ON cleaner_assignments FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- cleaner_availability
CREATE POLICY "Cleaners manage own availability"
    ON cleaner_availability FOR ALL USING (auth.uid() = cleaner_id);

CREATE POLICY "Admins read all availability"
    ON cleaner_availability FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- feedback
CREATE POLICY "Customers manage own feedback"
    ON feedback FOR ALL USING (auth.uid() = customer_id);

CREATE POLICY "Admins read all feedback"
    ON feedback FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- complaints
CREATE POLICY "Customers manage own complaints"
    ON complaints FOR ALL USING (auth.uid() = customer_id);

CREATE POLICY "Admins read all complaints"
    ON complaints FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- notifications
CREATE POLICY "Users read own notifications"
    ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
    ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- settings
CREATE POLICY "Anyone can read settings"
    ON settings FOR SELECT USING (true);

CREATE POLICY "Super admins manage settings"
    ON settings FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- complaint_messages
CREATE POLICY "Participants read messages"
    ON complaint_messages FOR SELECT USING (
        auth.uid() = sender_id
        OR EXISTS (SELECT 1 FROM complaints WHERE id = complaint_id AND customer_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE complaint_messages;
