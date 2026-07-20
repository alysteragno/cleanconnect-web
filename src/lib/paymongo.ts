import 'server-only'
import crypto from 'crypto'
import { createAdminClient } from '@/utils/supabase/server'
import { createNotification } from '@/app/actions/notifications'

// ── PayMongo server client ──────────────────────────────────────────────────
// Thin wrapper over the PayMongo REST API used for hosted Checkout Sessions.
// Test keys live in .env.local (PAYMONGO_SECRET_KEY / PAYMONGO_PUBLIC_KEY).
// Never import this from a Client Component — the secret key must stay server-side.

const PAYMONGO_API = 'https://api.paymongo.com/v1'

function secretKey(): string {
  const key = process.env.PAYMONGO_SECRET_KEY
  if (!key) throw new Error('PAYMONGO_SECRET_KEY is not set.')
  return key
}

/** PayMongo authenticates with HTTP Basic where the secret key is the username. */
function authHeader(): string {
  return `Basic ${Buffer.from(`${secretKey()}:`).toString('base64')}`
}

// Payment methods offered on the hosted checkout page.
// This account only has QRPh activated (GCash/Maya/GrabPay as direct methods
// require PayMongo business approval). QRPh is sufficient: it renders one QR the
// customer scans with GCash, Maya, or any InstaPay/QR Ph bank app — covering the
// manual methods this replaces. Add 'card' here once cards are enabled on the
// account, and 'gcash'/'paymaya'/'grab_pay' once those are approved.
export const DEFAULT_PAYMENT_METHODS = ['qrph'] as const

export type CheckoutSession = {
  id: string
  checkoutUrl: string
  paymentIntentId: string | null
}

type LineItem = { name: string; amount: number; quantity: number }

/**
 * Creates a PayMongo Checkout Session and returns its id + hosted URL.
 * `amount` is in pesos and is converted to centavos here.
 */
export async function createCheckoutSession(opts: {
  amount: number
  description: string
  lineItems: LineItem[]
  referenceNumber: string
  successUrl: string
  cancelUrl: string
  billing?: { name?: string; email?: string; phone?: string }
}): Promise<CheckoutSession> {
  const toCentavos = (peso: number) => Math.round(peso * 100)

  const body = {
    data: {
      attributes: {
        description: opts.description,
        reference_number: opts.referenceNumber,
        payment_method_types: [...DEFAULT_PAYMENT_METHODS],
        line_items: opts.lineItems.map((li) => ({
          currency: 'PHP',
          name: li.name,
          amount: toCentavos(li.amount),
          quantity: li.quantity,
        })),
        success_url: opts.successUrl,
        cancel_url: opts.cancelUrl,
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
        ...(opts.billing?.name || opts.billing?.email || opts.billing?.phone
          ? { billing: opts.billing }
          : {}),
      },
    },
  }

  const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = await res.json()
  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail ?? 'Failed to create PayMongo checkout session.'
    throw new Error(detail)
  }

  const attrs = json.data.attributes
  return {
    id: json.data.id as string,
    checkoutUrl: attrs.checkout_url as string,
    paymentIntentId: (attrs.payment_intent?.id as string) ?? null,
  }
}

/** Looks up a Checkout Session directly on PayMongo and reports whether it has a settled payment. */
async function retrieveCheckoutSession(sessionId: string): Promise<{ paid: boolean; paymentId: string | null }> {
  const res = await fetch(`${PAYMONGO_API}/checkout_sessions/${sessionId}`, {
    headers: { Authorization: authHeader() },
  })
  if (!res.ok) return { paid: false, paymentId: null }

  const json = await res.json()
  const payments = json?.data?.attributes?.payments as
    | Array<{ id: string; attributes?: { status?: string } }>
    | undefined
  const paidPayment = payments?.find((p) => p.attributes?.status === 'paid')
  return { paid: !!paidPayment, paymentId: paidPayment?.id ?? null }
}

/**
 * Fallback confirmation used by the payment success page. The webhook is the
 * source of truth for marking a booking paid, but webhook delivery can be
 * delayed, misconfigured, or missed entirely — so the return page also asks
 * PayMongo directly, right when the customer is looking at the screen,
 * instead of leaving them staring at "confirming..." indefinitely if the
 * webhook never arrives. Safe to call repeatedly: idempotent like the webhook.
 */
export async function confirmCheckoutPayment(bookingId: string): Promise<{ paid: boolean }> {
  try {
    const admin = createAdminClient()
    const { data: booking } = await admin
      .from('bookings')
      .select('id, customer_id, service_date, payment_status, paymongo_checkout_id')
      .eq('id', bookingId)
      .maybeSingle()

    if (!booking) return { paid: false }
    if (booking.payment_status === 'paid') return { paid: true }
    if (!booking.paymongo_checkout_id) return { paid: false }

    const { paid, paymentId } = await retrieveCheckoutSession(booking.paymongo_checkout_id)
    if (!paid) return { paid: false }

    const { error: updateErr } = await admin
      .from('bookings')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        paymongo_payment_id: paymentId,
      })
      .eq('id', booking.id)
    if (updateErr) return { paid: false }

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

    return { paid: true }
  } catch {
    // Best-effort fallback — the webhook remains the source of truth, so any
    // failure here (PayMongo unreachable, misconfigured keys, etc.) just means
    // the success page shows the "still confirming" copy instead of crashing.
    return { paid: false }
  }
}

// ── Webhook signature verification ──────────────────────────────────────────
// PayMongo signs webhooks with the header:
//   Paymongo-Signature: t=<timestamp>,te=<test_sig>,li=<live_sig>
// The signature is HMAC-SHA256 of `${t}.${rawBody}` keyed with the webhook's
// signing secret (PAYMONGO_WEBHOOK_SECRET, obtained when the webhook is created).

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET
  if (!secret || !signatureHeader) return false

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const [k, v] = kv.split('=')
      return [k?.trim(), v?.trim()]
    })
  ) as { t?: string; te?: string; li?: string }

  if (!parts.t) return false
  // Test keys sign the `te` field; live keys sign `li`. Verify against whichever
  // matches the key mode in use (test during development).
  const expected = process.env.PAYMONGO_SECRET_KEY?.startsWith('sk_live') ? parts.li : parts.te
  if (!expected) return false

  const computed = crypto
    .createHmac('sha256', secret)
    .update(`${parts.t}.${rawBody}`)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expected))
  } catch {
    return false
  }
}
