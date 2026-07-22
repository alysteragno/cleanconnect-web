-- Fires the "thank you for booking" customer email (src/lib/email.ts via
-- src/app/api/webhooks/booking-created/route.ts) on every INSERT into
-- `bookings` — regardless of whether the row came from the admin's phone-in
-- /bookings/new flow or directly from the mobile app (customers there write
-- straight to Supabase, bypassing the Next.js server entirely). A DB-level
-- trigger is the only place that reliably sees every booking either way.
--
-- This does the same thing the Dashboard's Database → Webhooks UI would set
-- up for you — written directly in SQL instead, since that UI entry can be
-- hidden until the pg_net extension below is enabled.
--
-- Run in Supabase SQL Editor.
--
-- ── BEFORE YOU RUN THIS ──────────────────────────────────────────────────
-- Replace the two placeholders below with real values:
--   1. <YOUR_DEPLOYED_DOMAIN> — the domain this Next.js app is deployed to
--      (e.g. https://maidforyouph.com). The route works from any host the
--      app answers on, since it's plain server code, not host-gated.
--   2. <BOOKING_WEBHOOK_SECRET> — must exactly match the BOOKING_WEBHOOK_SECRET
--      value in .env.local, so the route can verify the request actually
--      came from this trigger and not an outside caller.
-- ─────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION notify_booking_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://maidforyouph.com/api/webhooks/booking-created',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '4059a3bb0121c607109d3327165f0692212160f0f04a7c15b5253662ec241c05'
    ),
    body    := jsonb_build_object(
      'type', 'INSERT',
      'table', 'bookings',
      'record', jsonb_build_object('id', NEW.id)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_booking_created ON bookings;
CREATE TRIGGER trigger_notify_booking_created
AFTER INSERT ON bookings
FOR EACH ROW EXECUTE FUNCTION notify_booking_created();
