import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { createNotification } from '@/app/actions/notifications'
import { revalidatePath } from 'next/cache'

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

    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'cleaner') {
      return NextResponse.json({ error: 'Only cleaners can confirm cash collection.' }, { status: 403 })
    }

    const admin = createAdminClient()

    const { data: booking } = await admin
      .from('bookings')
      .select('id, payment_method, payment_status, customer_id, service_date')
      .eq('id', booking_id)
      .single()

    if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    if (booking.payment_method !== 'cash') {
      return NextResponse.json({ error: 'This booking is not a cash payment.' }, { status: 422 })
    }
    if (booking.payment_status === 'paid') {
      return NextResponse.json({ error: 'Payment already confirmed.' }, { status: 409 })
    }

    const { data: assignment } = await admin
      .from('cleaner_assignments')
      .select('cleaner_id')
      .eq('booking_id', booking_id)
      .eq('cleaner_id', user.id)
      .single()

    if (!assignment) {
      return NextResponse.json({ error: 'You are not assigned to this booking.' }, { status: 403 })
    }

    const { error: updateErr } = await admin
      .from('bookings')
      .update({ payment_status: 'paid' })
      .eq('id', booking_id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    const dateStr = new Date(booking.service_date).toLocaleDateString('en-PH', {
      month: 'short', day: 'numeric',
    })

    await createNotification({
      userId: booking.customer_id,
      title: 'Payment Confirmed',
      body: `Your cash payment for the appointment on ${dateStr} has been received. Thank you!`,
      type: 'payment_confirmed',
      bookingId: booking_id,
    })

    revalidatePath(`/admin/bookings/${booking_id}`)
    revalidatePath('/admin/bookings')

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
