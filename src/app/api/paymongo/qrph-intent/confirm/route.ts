import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { confirmQrPhPayment } from '@/lib/paymongo'

// Polled by the mobile QR screen while a QR Ph code is on screen. Actively
// retrieves the Payment Intent from PayMongo and flips payment_status='paid'
// if settled — this is the primary confirmation path for the native QR flow
// (see caveat in lib/paymongo.ts on why this doesn't lean on a webhook event
// payload shape for this particular flow). Safe to call repeatedly.
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
      .select('id, customer_id')
      .eq('id', booking_id)
      .single()
    if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })

    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'super_admin'
    if (!isAdmin && booking.customer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const { paid, detail } = await confirmQrPhPayment(booking_id)
    return NextResponse.json({ paid, detail })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
