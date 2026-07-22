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

// ── Settled-payment detail ───────────────────────────────────────────────────
// Both confirmation paths below (QR Ph Payment Intent and hosted Checkout
// Session) resolve to a PayMongo `Payment` resource once money has actually
// moved. Both APIs already embed the full resource — not just its id — in
// their `payments[]` array, so no extra API call is needed to get amount,
// fee, and the rest; earlier versions of this file just weren't reading it.

export type PaymongoPaymentDetail = {
  id: string
  /** Pesos, converted from PayMongo's centavos. */
  amount: number
  /** PayMongo's processing fee, pesos. */
  fee: number
  /** amount - fee, pesos — what actually lands in the account. */
  netAmount: number
  currency: string
  /** e.g. 'qrph', 'gcash', 'card' — whichever method the customer actually used. */
  sourceType: string | null
  status: string
  /** ISO timestamp — PayMongo's own paid_at, not when this app recorded it. */
  paidAt: string | null
}

export type RawPayment = {
  id: string
  attributes?: {
    amount?: number
    fee?: number
    net_amount?: number
    currency?: string
    status?: string
    paid_at?: number | null
    source?: { type?: string } | null
  }
}

/** Converts a raw PayMongo Payment resource (as embedded in a Payment Intent's or Checkout Session's `payments[]`, or delivered directly by a `payment.paid` webhook) into our display/storage shape. */
export function paymongoDetailFromRawPayment(payment: RawPayment): PaymongoPaymentDetail {
  const attrs = payment.attributes ?? {}
  const toPesos = (centavos?: number) => (typeof centavos === 'number' ? centavos / 100 : 0)
  return {
    id: payment.id,
    amount: toPesos(attrs.amount),
    fee: toPesos(attrs.fee),
    netAmount: toPesos(attrs.net_amount),
    currency: attrs.currency ?? 'PHP',
    sourceType: attrs.source?.type ?? null,
    status: attrs.status ?? 'paid',
    paidAt: typeof attrs.paid_at === 'number' ? new Date(attrs.paid_at * 1000).toISOString() : null,
  }
}

/** Shape of the DB update every settlement path writes — keeps the columns in sync in one place. */
export function paymentDetailColumns(detail: PaymongoPaymentDetail) {
  return {
    paymongo_payment_id: detail.id,
    paymongo_amount: detail.amount,
    paymongo_fee: detail.fee,
    paymongo_net_amount: detail.netAmount,
    paymongo_currency: detail.currency,
    paymongo_source_type: detail.sourceType,
    paymongo_status: detail.status,
    paymongo_paid_at: detail.paidAt,
  }
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

// ── Native QR Ph via Payment Intents (no hosted page / redirect) ────────────
// Used by the mobile app to render the QR code directly in-app instead of
// opening any browser/webview. Flow: create a Payment Intent, create a qrph
// Payment Method, attach it — the attach response carries the QR image.
//
// Field-name caveat: PayMongo's own docs place the QR image at
// `next_action.code.image_url`, but this has not been verified against a
// live API response in this environment (sandbox calls were blocked here).
// `createQrPhIntent` below checks a couple of plausible shapes and returns
// `qrImageUrl: null` + the raw `next_action` if none match, so a first real
// test fails loudly instead of silently — check `raw_next_action` in that
// case and adjust the field path.
//
// Confirmation deliberately does NOT rely on a webhook event payload shape
// for this flow (also unverified) — it uses `confirmQrPhPayment`, which
// actively retrieves the Payment Intent from PayMongo and checks its
// `payments[]` array (a field confirmed present on the Payment Intent
// resource). This mirrors the existing `confirmCheckoutPayment` fallback
// below, just promoted to be the primary confirmation path instead of a
// fallback — the mobile QR screen polls it while the code is on screen.

export type QrPhIntent = {
  id: string
  clientKey: string
  qrImageUrl: string | null
  /**
   * PayMongo's sandbox-only "authorize this test payment" page
   * (`next_action.code.test_url`). Only present when using `sk_test_...`
   * keys — a real e-wallet app can't scan a sandbox QR, so PayMongo hands
   * back this hosted page instead as the way to simulate a scan during
   * development. Never present in live mode.
   */
  testUrl: string | null
  status: string
  rawNextAction?: unknown
}

/** Creates a fresh Payment Intent + qrph Payment Method and attaches them. */
export async function createQrPhIntent(opts: {
  amount: number // pesos
  description: string
  bookingId: string
  billing?: { name?: string; email?: string; phone?: string }
}): Promise<QrPhIntent> {
  const toCentavos = (peso: number) => Math.round(peso * 100)

  const intentRes = await fetch(`${PAYMONGO_API}/payment_intents`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: toCentavos(opts.amount),
          currency: 'PHP',
          capture_type: 'automatic',
          description: opts.description,
          payment_method_allowed: ['qrph'],
          payment_method_options: { qrph: {} },
          metadata: { booking_id: opts.bookingId },
        },
      },
    }),
  })
  const intentJson = await intentRes.json()
  if (!intentRes.ok) {
    throw new Error(intentJson?.errors?.[0]?.detail ?? 'Failed to create PayMongo payment intent.')
  }
  const intentId = intentJson.data.id as string
  const clientKey = intentJson.data.attributes.client_key as string

  const pmRes = await fetch(`${PAYMONGO_API}/payment_methods`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: { attributes: { type: 'qrph', billing: opts.billing ?? {} } },
    }),
  })
  const pmJson = await pmRes.json()
  if (!pmRes.ok) {
    throw new Error(pmJson?.errors?.[0]?.detail ?? 'Failed to create QR Ph payment method.')
  }
  const paymentMethodId = pmJson.data.id as string

  const attachRes = await fetch(`${PAYMONGO_API}/payment_intents/${intentId}/attach`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: { attributes: { payment_method: paymentMethodId, client_key: clientKey } },
    }),
  })
  const attachJson = await attachRes.json()
  if (!attachRes.ok) {
    throw new Error(attachJson?.errors?.[0]?.detail ?? 'Failed to attach QR Ph payment method.')
  }

  const attrs = attachJson.data.attributes
  const nextAction = attrs.next_action ?? {}
  const qrImageUrl: string | null =
    nextAction?.code?.image_url ??
    nextAction?.code?.image ??
    nextAction?.qrph?.image_url ??
    null
  const testUrl: string | null =
    nextAction?.code?.test_url ??
    nextAction?.qrph?.test_url ??
    null

  return {
    id: intentId,
    clientKey,
    qrImageUrl,
    testUrl,
    status: attrs.status,
    rawNextAction: qrImageUrl ? undefined : nextAction,
  }
}

/**
 * Retrieves a Payment Intent from PayMongo directly and reports whether it
 * has a settled payment. This is the primary confirmation path for the QR Ph
 * native flow (see caveat above) — the mobile QR screen polls the
 * `/api/paymongo/qrph-intent/confirm` route that wraps this while the code
 * is on screen.
 */
export async function confirmQrPhPayment(bookingId: string): Promise<{ paid: boolean; detail?: PaymongoPaymentDetail }> {
  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, customer_id, service_date, payment_status, paymongo_payment_intent_id')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return { paid: false }
  if (booking.payment_status === 'paid') return { paid: true }
  if (!booking.paymongo_payment_intent_id) return { paid: false }

  const res = await fetch(`${PAYMONGO_API}/payment_intents/${booking.paymongo_payment_intent_id}`, {
    headers: { Authorization: authHeader() },
  })
  if (!res.ok) return { paid: false }

  const json = await res.json()
  const attrs = json?.data?.attributes
  const payments = attrs?.payments as RawPayment[] | undefined
  const paidPayment = payments?.find((p) => p.attributes?.status === 'paid')
  if (!paidPayment) return { paid: false }

  const detail = paymongoDetailFromRawPayment(paidPayment)

  const { error: updateErr } = await admin
    .from('bookings')
    .update({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      ...paymentDetailColumns(detail),
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

  return { paid: true, detail }
}

/** Looks up a Checkout Session directly on PayMongo and reports whether it has a settled payment. */
async function retrieveCheckoutSession(sessionId: string): Promise<{ paid: boolean; detail: PaymongoPaymentDetail | null }> {
  const res = await fetch(`${PAYMONGO_API}/checkout_sessions/${sessionId}`, {
    headers: { Authorization: authHeader() },
  })
  if (!res.ok) return { paid: false, detail: null }

  const json = await res.json()
  const payments = json?.data?.attributes?.payments as RawPayment[] | undefined
  const paidPayment = payments?.find((p) => p.attributes?.status === 'paid')
  return { paid: !!paidPayment, detail: paidPayment ? paymongoDetailFromRawPayment(paidPayment) : null }
}

/**
 * Retrieves the current payment detail directly from PayMongo for a booking
 * that's already marked paid — rather than only trusting whatever got
 * cached in the DB at settlement time. That cache depends on the webhook (or
 * the poll-based confirm path) having run and matched PayMongo's actual
 * field shape, which — per the caveats elsewhere in this file — has never
 * been verified against a live response in this environment; if it silently
 * mismatched, the DB columns are just empty even though the payment genuinely
 * settled. This asks PayMongo directly instead, tries the payment intent id
 * first (native QR flow) and falls back to the checkout id (hosted flow),
 * and self-heals the DB row on success so future page loads don't need to
 * re-fetch. Called from the admin booking page whenever payment_status is
 * 'paid' and either id is on file; returns null (not an error) if neither id
 * is present (e.g. a manually marked-paid booking with no PayMongo history)
 * or PayMongo can't be reached — the page falls back to whatever's cached.
 */
export async function fetchLivePaymentDetail(opts: {
  bookingId: string
  paymentIntentId: string | null
  checkoutId: string | null
}): Promise<PaymongoPaymentDetail | null> {
  let detail: PaymongoPaymentDetail | null = null

  try {
    if (opts.paymentIntentId) {
      const res = await fetch(`${PAYMONGO_API}/payment_intents/${opts.paymentIntentId}`, {
        headers: { Authorization: authHeader() },
      })
      if (res.ok) {
        const json = await res.json()
        const payments = json?.data?.attributes?.payments as RawPayment[] | undefined
        const paid = payments?.find((p) => p.attributes?.status === 'paid')
        if (paid) detail = paymongoDetailFromRawPayment(paid)
      }
    }
    if (!detail && opts.checkoutId) {
      const { detail: checkoutDetail } = await retrieveCheckoutSession(opts.checkoutId)
      detail = checkoutDetail
    }
  } catch {
    // PayMongo unreachable, bad key, etc. — return whatever's cached instead of crashing the page.
    return null
  }

  if (!detail) return null

  // Best-effort self-heal — a failure here doesn't change what's returned for display.
  const admin = createAdminClient()
  await admin.from('bookings').update(paymentDetailColumns(detail)).eq('id', opts.bookingId)

  return detail
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

    const { paid, detail } = await retrieveCheckoutSession(booking.paymongo_checkout_id)
    if (!paid || !detail) return { paid: false }

    const { error: updateErr } = await admin
      .from('bookings')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        ...paymentDetailColumns(detail),
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
