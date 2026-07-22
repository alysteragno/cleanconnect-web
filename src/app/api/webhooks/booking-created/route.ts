import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/utils/supabase/server'
import { sendBookingConfirmationEmail } from '@/lib/email'

// Supabase Database Webhook receiver — fires on every INSERT into `bookings`,
// regardless of which client wrote the row. This app only ever inserts a
// booking from one place (createManualBooking, the admin phone-in flow at
// /bookings/new); customers can also book directly from the Expo mobile app,
// which writes straight to Supabase and never touches this Next.js server. A
// DB-level webhook is the only place that reliably sees every booking either
// way, so the "thank you for booking" email lands regardless of origin.
//
// One-time setup (Supabase Dashboard → Database → Webhooks → Create a new hook):
//   Table: bookings   Events: Insert   Type: HTTP Request (POST)
//   URL: https://<your-deployed-domain>/api/webhooks/booking-created
//   HTTP Headers: x-webhook-secret: <same value as BOOKING_WEBHOOK_SECRET below>
//
// The row payload is only used as a "something happened, go look at booking
// X" signal, not trusted verbatim — the actual booking is re-fetched fresh by
// id (see comment below) so a same-request follow-up UPDATE (e.g. the admin
// flow's base_price correction — see createManualBooking) can't leak a
// stale/incorrect price into the email via a race with this insert trigger.

function verifySecret(req: NextRequest): boolean {
  const expected = process.env.BOOKING_WEBHOOK_SECRET
  const provided = req.headers.get('x-webhook-secret')
  if (!expected || !provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: { id: string } | null
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: 'Invalid or missing webhook secret.' }, { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  if (payload.type !== 'INSERT' || payload.table !== 'bookings' || !payload.record?.id) {
    return NextResponse.json({ received: true, skipped: true })
  }

  const admin = createAdminClient()

  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .select(`
      id, customer_id, service_name, service_slug, service_date, service_time,
      base_price, payment_method,
      address_unit, address_street, address_barangay, address_city, address_province
    `)
    .eq('id', payload.record.id)
    .maybeSingle()

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 })
  }
  if (!booking) {
    return NextResponse.json({ received: true, skipped: true, reason: 'Booking no longer exists.' })
  }

  const [{ data: profile }, { data: userData, error: userError }] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', booking.customer_id).maybeSingle(),
    admin.auth.admin.getUserById(booking.customer_id),
  ])

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 })
  }
  const email = userData?.user?.email
  if (!email) {
    return NextResponse.json({ received: true, skipped: true, reason: 'Customer has no email on file.' })
  }

  const address = [
    booking.address_unit, booking.address_street, booking.address_barangay,
    booking.address_city, booking.address_province,
  ].filter(Boolean).join(', ')

  const { error: sendError } = await sendBookingConfirmationEmail(
    {
      bookingId: booking.id,
      customerName: profile?.full_name ?? 'there',
      serviceName: booking.service_name ?? booking.service_slug ?? 'Cleaning Service',
      serviceDate: booking.service_date,
      serviceTime: booking.service_time,
      address: address || 'On file with your booking',
      basePrice: booking.base_price,
      paymentMethod: booking.payment_method,
    },
    email
  )

  if (sendError) {
    return NextResponse.json({ error: sendError }, { status: 502 })
  }

  return NextResponse.json({ received: true, sent: true })
}
