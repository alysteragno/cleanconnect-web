import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/server'
import { createNotification } from '@/app/actions/notifications'
import { verifyWebhookSignature, paymongoDetailFromRawPayment, paymentDetailColumns, type RawPayment } from '@/lib/paymongo'

// PayMongo webhook receiver. Verifies the signature, then marks the matching
// booking as paid once PayMongo confirms payment — from either flow this app
// uses: the hosted Checkout Session (checkout_session.payment.paid) or the
// inline QR Ph Payment Intent (payment.paid — that event fires for any
// settled Payment regardless of origin, which is the only server-to-server
// signal available for the intent flow since it never creates a checkout
// session at all).
//
// Register this endpoint in the PayMongo dashboard for BOTH events. The
// signing secret it returns must be set as PAYMONGO_WEBHOOK_SECRET.
// Verification fails closed — an unsigned/invalid request never changes
// payment state. This is a safety net, not the primary confirmation path for
// the QR flow — the admin page polls /api/paymongo/qrph-intent/confirm while
// the QR is on screen; this exists in case that tab closes before it lands.
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

  if (!resource) {
    return NextResponse.json({ received: true })
  }

  const admin = createAdminClient()

  if (eventType === 'checkout_session.payment.paid') {
    const checkoutId = resource.id ?? null
    const referenceNumber = resource.attributes?.reference_number ?? null
    const rawPayment = resource.attributes?.payments?.[0] ?? null

    let bookingQuery = admin
      .from('bookings')
      .select('id, customer_id, service_date, payment_status')
    bookingQuery = referenceNumber
      ? bookingQuery.eq('id', referenceNumber)
      : bookingQuery.eq('paymongo_checkout_id', checkoutId)

    const { data: booking } = await bookingQuery.maybeSingle()
    if (!booking) return NextResponse.json({ received: true, matched: false })
    if (booking.payment_status === 'paid') return NextResponse.json({ received: true, alreadyPaid: true })

    const detail = rawPayment ? paymongoDetailFromRawPayment(rawPayment) : null

    const { error: updateErr } = await admin
      .from('bookings')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        ...(checkoutId ? { paymongo_checkout_id: checkoutId } : {}),
        ...(detail ? paymentDetailColumns(detail) : {}),
      })
      .eq('id', booking.id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    await notifyPaid(admin, booking)
    revalidatePath(`/admin/bookings/${booking.id}`)
    revalidatePath('/admin/bookings')
    return NextResponse.json({ received: true })
  }

  if (eventType === 'payment.paid') {
    // Fires for a Payment settled via a bare Payment Intent (the QR Ph inline
    // flow) — there is no checkout session or reference_number here, only the
    // Payment resource itself. Match the booking via the intent id we stored
    // when the intent was created (paymongo_payment_intent_id). Field-path
    // caveat: `payment_intent_id` on the Payment resource's own attributes
    // hasn't been verified against a live payload in this environment (see
    // the same caveat in lib/paymongo.ts) — falls through to no-op (200, so
    // PayMongo doesn't retry forever) rather than throwing if it's absent;
    // the poll-based confirmQrPhPayment path remains the primary route.
    const intentId = resource.attributes?.payment_intent_id ?? null
    if (!intentId) return NextResponse.json({ received: true, matched: false })

    const { data: booking } = await admin
      .from('bookings')
      .select('id, customer_id, service_date, payment_status')
      .eq('paymongo_payment_intent_id', intentId)
      .maybeSingle()
    if (!booking) return NextResponse.json({ received: true, matched: false })
    if (booking.payment_status === 'paid') return NextResponse.json({ received: true, alreadyPaid: true })

    const detail = paymongoDetailFromRawPayment(resource)

    const { error: updateErr } = await admin
      .from('bookings')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        ...paymentDetailColumns(detail),
      })
      .eq('id', booking.id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    await notifyPaid(admin, booking)
    revalidatePath(`/admin/bookings/${booking.id}`)
    revalidatePath('/admin/bookings')
    return NextResponse.json({ received: true })
  }

  // Acknowledge everything else with 200 so PayMongo does not retry events we
  // intentionally ignore.
  return NextResponse.json({ received: true })
}

async function notifyPaid(
  admin: ReturnType<typeof createAdminClient>,
  booking: { id: string; customer_id: string; service_date: string }
) {
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
}

// ── Minimal shape of the PayMongo webhook payload we consume ─────────────────
// `data` is either a Checkout Session (checkout_session.payment.paid — has
// reference_number/payments[]) or a bare Payment resource itself
// (payment.paid — has amount/fee/etc. + payment_intent_id directly). Both
// shapes are merged here since which one applies depends on `type`.
type PayMongoEvent = {
  data?: {
    attributes?: {
      type?: string
      data?: RawPayment & {
        attributes?: {
          reference_number?: string | null
          payment_intent_id?: string | null
          payments?: RawPayment[]
        }
      }
    }
  }
}
