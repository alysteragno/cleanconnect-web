import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { createQrPhIntent } from '@/lib/paymongo'
import { PAYMENT_METHOD_META } from '@/components/payment-icons'

// Creates a native PayMongo QR Ph Payment Intent for a booking and returns
// the QR code image directly — no hosted checkout page, no redirect. Used by
// the mobile app to render the QR in its own UI. Same dual-auth pattern as
// /api/paymongo/checkout (Bearer token for mobile, cookie session for web).
//
// Unlike /api/paymongo/checkout, this is NOT idempotent by design: QR Ph
// codes expire quickly (~10 min), so every call issues a fresh Payment
// Intent + QR rather than trying to reuse/refresh a stale one.
export async function POST(req: NextRequest) {
  try {
    const { booking_id } = await req.json()
    if (!booking_id) return NextResponse.json({ error: 'booking_id required.' }, { status: 400 })

    let user: { id: string } | null = null
    const authHeader = req.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const admin = createAdminClient()
      const { data } = await admin.auth.getUser(token)
      user = data.user
    } else {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      user = data.user
    }
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const admin = createAdminClient()

    const { data: booking } = await admin
      .from('bookings')
      .select(`
        id, customer_id, service_name, base_price, cancellation_fee,
        payment_method, payment_status,
        profiles!customer_id (full_name, phone)
      `)
      .eq('id', booking_id)
      .single()

    if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })

    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'super_admin'
    if (!isAdmin && booking.customer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    if (!PAYMENT_METHOD_META[booking.payment_method]?.isDigital) {
      return NextResponse.json({ error: 'This payment method is collected on-site, not through PayMongo.' }, { status: 422 })
    }
    if (booking.payment_status === 'paid') {
      return NextResponse.json({ error: 'This booking is already paid.' }, { status: 409 })
    }

    const amount = Number(booking.base_price ?? 0) + Number(booking.cancellation_fee ?? 0)
    if (!(amount > 0)) {
      return NextResponse.json({ error: 'Booking has no amount due yet.' }, { status: 422 })
    }

    const customer = booking.profiles as unknown as { full_name?: string; phone?: string } | null
    const serviceLabel = booking.service_name ?? 'Cleaning service'

    // PayMongo requires billing.name AND billing.email together whenever a
    // billing object is sent at all for a qrph payment method (phone is the
    // only optional field) — profiles has no email column, so it's fetched
    // from auth.users here. If either is missing, omit billing entirely
    // (an empty/absent billing object is accepted) rather than send a
    // partial one that PayMongo will 400 on.
    const { data: customerAuth } = await admin.auth.admin.getUserById(booking.customer_id)
    const customerEmail = customerAuth?.user?.email

    const intent = await createQrPhIntent({
      amount,
      description: `${serviceLabel} — Maid For You Cleaning Services booking #${booking.id.slice(0, 8).toUpperCase()}`,
      bookingId: booking.id,
      billing: customer?.full_name && customerEmail
        ? { name: customer.full_name, email: customerEmail, phone: customer.phone ?? undefined }
        : undefined,
    })

    const { error: updateErr } = await admin
      .from('bookings')
      .update({ paymongo_payment_intent_id: intent.id })
      .eq('id', booking.id)
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    if (!intent.qrImageUrl) {
      // Field-path guess didn't match the live response — surface enough to debug
      // without ever failing silently (see caveat in lib/paymongo.ts).
      console.error('[qrph-intent] no QR image found in next_action:', JSON.stringify(intent.rawNextAction))
      return NextResponse.json({ error: 'PayMongo did not return a QR code image. Please try again or contact support.' }, { status: 502 })
    }

    return NextResponse.json({
      payment_intent_id: intent.id,
      qr_image_url: intent.qrImageUrl,
      // Only ever non-null on sk_test_ keys — see the QrPhIntent.testUrl doc
      // comment in lib/paymongo.ts. Lets the mobile app offer a "simulate
      // payment" affordance during development without any live-mode change.
      test_url: intent.testUrl,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
