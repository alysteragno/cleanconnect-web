import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/server'
import { createNotification } from '@/app/actions/notifications'
import { verifyWebhookSignature } from '@/lib/paymongo'

// PayMongo webhook receiver. Verifies the signature, then marks the matching
// booking as paid when PayMongo confirms a Checkout Session payment.
//
// Register this endpoint in the PayMongo dashboard (events:
// checkout_session.payment.paid). The signing secret it returns must be set as
// PAYMONGO_WEBHOOK_SECRET. Verification fails closed — an unsigned/invalid
// request never changes payment state.
export async function POST(req: NextRequest) {
  // Raw body is required for HMAC signature verification — read it before parsing.
  const raw = await req.text()
  const signature = req.headers.get('Paymongo-Signature')

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
  }

  let event: PayMongoEvent
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const eventType = event?.data?.attributes?.type
  const resource = event?.data?.attributes?.data

  // Only act on a confirmed checkout payment. Acknowledge everything else with 200
  // so PayMongo does not retry events we intentionally ignore.
  if (eventType !== 'checkout_session.payment.paid' || !resource) {
    return NextResponse.json({ received: true })
  }

  const checkoutId = resource.id ?? null
  const referenceNumber = resource.attributes?.reference_number ?? null
  const paymentId = resource.attributes?.payments?.[0]?.id ?? null

  const admin = createAdminClient()

  // Resolve the booking by our reference_number (the booking id) first, falling
  // back to the stored checkout id.
  let bookingQuery = admin
    .from('bookings')
    .select('id, customer_id, service_date, payment_status')
  bookingQuery = referenceNumber
    ? bookingQuery.eq('id', referenceNumber)
    : bookingQuery.eq('paymongo_checkout_id', checkoutId)

  const { data: booking } = await bookingQuery.maybeSingle()

  if (!booking) {
    // Nothing to update, but acknowledge so PayMongo stops retrying.
    return NextResponse.json({ received: true, matched: false })
  }

  // Idempotent — webhooks can be delivered more than once.
  if (booking.payment_status === 'paid') {
    return NextResponse.json({ received: true, alreadyPaid: true })
  }

  const { error: updateErr } = await admin
    .from('bookings')
    .update({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      paymongo_payment_id: paymentId,
      ...(checkoutId ? { paymongo_checkout_id: checkoutId } : {}),
    })
    .eq('id', booking.id)

  if (updateErr) {
    // 500 → PayMongo will retry, which is the desired behaviour on a transient failure.
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  const dateStr = new Date(booking.service_date).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric',
  })
  await createNotification({
    userId: booking.customer_id,
    title: 'Payment Confirmed',
    body: `Your payment for the appointment on ${dateStr} has been received. Thank you!`,
    type: 'payment_confirmed',
    bookingId: booking.id,
  })

  revalidatePath(`/admin/bookings/${booking.id}`)
  revalidatePath('/admin/bookings')

  return NextResponse.json({ received: true })
}

// ── Minimal shape of the PayMongo webhook payload we consume ─────────────────
type PayMongoEvent = {
  data?: {
    attributes?: {
      type?: string
      data?: {
        id?: string
        attributes?: {
          reference_number?: string | null
          payments?: Array<{ id?: string }>
        }
      }
    }
  }
}
