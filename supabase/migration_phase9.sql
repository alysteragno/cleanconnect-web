-- CleanConnect Phase 9 Migration
-- DB trigger: notify all staff when a new booking is inserted
-- This fires regardless of how the booking is created (customer form, admin seed, API).

CREATE OR REPLACE FUNCTION notify_staff_on_new_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff_id  UUID;
  date_label TEXT;
BEGIN
  date_label := TO_CHAR(NEW.service_date, 'Mon DD, YYYY');

  FOR staff_id IN
    SELECT id FROM profiles
    WHERE role IN ('super_admin', 'branch_manager')
      AND is_active = true
  LOOP
    INSERT INTO notifications (user_id, title, body, type, booking_id)
    VALUES (
      staff_id,
      'New Booking Request',
      'A booking has been submitted for ' || date_label || '. Review and dispatch.',
      'booking_new',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_booking_inserted ON bookings;
CREATE TRIGGER on_booking_inserted
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_staff_on_new_booking();

-- Track which admin posted each announcement
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
