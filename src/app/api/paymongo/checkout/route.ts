import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { createCheckoutSession } from '@/lib/paymongo'

// Creates (or returns the existing) PayMongo hosted Checkout Session for a booking.
// Callable from the web admin (super_admin cookie session) or the mobile app
// (Bearer access token belonging to the booking's own customer) — same dual-auth
// pattern as /api/collect-cash.
export async function POST(req: NextRequest) {
  try {
    const { booking_id } = await req.json()
    if (!booking_id) return NextResponse.json({ error: 'booking_id required.' }, { status: 400 })

    // ── Authenticate: Bearer token (mobile) or cookie session (web) ──────────
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
        id, customer_id, service_name, service_date, base_price, cancellation_fee,
        payment_method, payment_status, paymongo_checkout_url,
        profiles!customer_id (full_name, phone)
      `)
      .eq('id', booking_id)
      .single()

    if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })

    // Only the owning customer or a super_admin may generate the link.
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const isAdmin = profile?.role === 'super_admin'
    if (!isAdmin && booking.customer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    // PayMongo cannot collect physical cash — that stays the cleaner-confirmed flow.
    if (booking.payment_method === 'cash') {
      return NextResponse.json({ error: 'Cash payments are collected on-site by the cleaner.' }, { status: 422 })
    }
    if (booking.payment_status === 'paid') {
      return NextResponse.json({ error: 'This booking is already paid.' }, { status: 409 })
    }

    // Idempotent: reuse an existing checkout session instead of creating duplicates.
    if (booking.paymongo_checkout_url) {
      return NextResponse.json({ checkout_url: booking.paymongo_checkout_url, reused: true })
    }

    const amount = Number(booking.base_price ?? 0) + Number(booking.cancellation_fee ?? 0)
    if (!(amount > 0)) {
      return NextResponse.json({ error: 'Booking has no amount due yet.' }, { status: 422 })
    }

    const customer = booking.profiles as unknown as { full_name?: string; phone?: string } | null
    const serviceLabel = booking.service_name ?? 'Cleaning service'
    const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? ''

    const session = await createCheckoutSession({
      amount,
      description: `${serviceLabel} — CleanConnect booking #${booking.id.slice(0, 8).toUpperCase()}`,
      lineItems: [{ name: serviceLabel, amount, quantity: 1 }],
      referenceNumber: booking.id,
      successUrl: `${webUrl}/payment/success?booking=${booking.id}`,
      cancelUrl: `${webUrl}/payment/cancelled?booking=${booking.id}`,
      billing: customer?.full_name ? { name: customer.full_name } : undefined,
    })

    const { error: updateErr } = await admin
      .from('bookings')
      .update({
        paymongo_checkout_id: session.id,
        paymongo_payment_intent_id: session.paymentIntentId,
        paymongo_checkout_url: session.checkoutUrl,
      })
      .eq('id', booking.id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    revalidatePath(`/admin/bookings/${booking.id}`)
    revalidatePath('/admin/bookings')

    return NextResponse.json({ checkout_url: session.checkoutUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
