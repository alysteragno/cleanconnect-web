-- Prevent a cleaner from being 'assigned' to two overlapping bookings at the
-- DB level (not just in application code). Mirrors the ±2h conflict buffer
-- already used by the AI dispatch engine (src/lib/ai-assignment.ts
-- hasTimeConflict) and now also enforced in the write paths
-- (dispatchCleaners, forceAssignCleaner, confirmAIDispatch) — this migration
-- adds the same rule as a real Postgres EXCLUDE constraint so it holds even
-- for direct DB writes (e.g. from the mobile app or the SQL editor).
--
-- Run in Supabase SQL Editor.
--
-- ── BEFORE YOU RUN THIS ──────────────────────────────────────────────────
-- An EXCLUDE constraint is checked against ALL existing rows at creation
-- time and will fail to install if any conflict already exists. Run this
-- diagnostic first and resolve any rows it returns (reassign or decline one
-- of the two conflicting cleaner_assignments) before running the rest of
-- this file:
--
--   SELECT ca1.id AS assignment_1, ca2.id AS assignment_2,
--          ca1.cleaner_id, b1.service_date,
--          b1.service_time AS time_1, b2.service_time AS time_2,
--          ca1.booking_id AS booking_1, ca2.booking_id AS booking_2
--     FROM cleaner_assignments ca1
--     JOIN cleaner_assignments ca2
--       ON ca1.cleaner_id = ca2.cleaner_id AND ca1.id < ca2.id
--     JOIN bookings b1 ON b1.id = ca1.booking_id
--     JOIN bookings b2 ON b2.id = ca2.booking_id
--    WHERE ca1.status = 'assigned' AND ca2.status = 'assigned'
--      AND b1.service_date = b2.service_date
--      AND (EXTRACT(EPOCH FROM b1.service_time) / 60 - 120)
--        < (EXTRACT(EPOCH FROM b2.service_time) / 60 + COALESCE(b2.duration_hours, 2) * 60 + 120)
--      AND (EXTRACT(EPOCH FROM b1.service_time) / 60 + COALESCE(b1.duration_hours, 2) * 60 + 120)
--        > (EXTRACT(EPOCH FROM b2.service_time) / 60 - 120);
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Needed for a GiST exclusion constraint over an equality column (cleaner_id)
--    combined with a range column (schedule_window).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Denormalized "busy window" per assignment — [service start - 2h, service
--    end + 2h) — kept in sync by triggers below. EXCLUDE constraints can only
--    read the constrained table's own columns, so the booking's schedule has
--    to be mirrored here rather than joined at constraint-check time.
ALTER TABLE cleaner_assignments ADD COLUMN IF NOT EXISTS schedule_window TSRANGE;

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

DROP TRIGGER IF EXISTS trigger_sync_cleaner_assignment_window ON cleaner_assignments;
CREATE TRIGGER trigger_sync_cleaner_assignment_window
BEFORE INSERT OR UPDATE ON cleaner_assignments
FOR EACH ROW EXECUTE FUNCTION sync_cleaner_assignment_window();

-- 3. If a booking's own schedule changes after a cleaner is already
--    assigned, refresh the dependent assignment rows' windows so the
--    constraint stays accurate. (No reschedule UI exists in the app today,
--    but this keeps the constraint correct if one is ever added, and
--    protects against a direct DB edit.)
CREATE OR REPLACE FUNCTION resync_dependent_cleaner_assignment_windows()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE cleaner_assignments SET status = status WHERE booking_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_resync_cleaner_assignment_windows ON bookings;
CREATE TRIGGER trigger_resync_cleaner_assignment_windows
AFTER UPDATE OF service_date, service_time, duration_hours ON bookings
FOR EACH ROW EXECUTE FUNCTION resync_dependent_cleaner_assignment_windows();

-- 4. Backfill schedule_window for every existing row via the trigger above,
--    then lock the column down.
UPDATE cleaner_assignments SET status = status;
ALTER TABLE cleaner_assignments ALTER COLUMN schedule_window SET NOT NULL;

-- 5. The actual constraint: no two 'assigned' rows for the same cleaner may
--    have overlapping schedule_windows. Declined/completed rows are exempt
--    (they no longer represent a real commitment on the cleaner's time).
ALTER TABLE cleaner_assignments DROP CONSTRAINT IF EXISTS cleaner_assignments_no_overlap;
ALTER TABLE cleaner_assignments
  ADD CONSTRAINT cleaner_assignments_no_overlap
  EXCLUDE USING gist (
    cleaner_id WITH =,
    schedule_window WITH &&
  ) WHERE (status = 'assigned');
