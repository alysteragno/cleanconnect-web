'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { createNotification } from './notifications'

export type BookingState = { error: string } | undefined

export async function createBooking(
  state: BookingState,
  formData: FormData
): Promise<BookingState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be logged in to book a service.' }

  const branch_id = formData.get('branch_id') as string
  const sqmRaw = formData.get('property_sqm') as string
  const service_date = formData.get('service_date') as string
  const service_time = formData.get('service_time') as string
  const address_unit = formData.get('address_unit') as string
  const address_street = formData.get('address_street') as string
  const address_city = formData.get('address_city') as string
  const address_province = formData.get('address_province') as string
  const service_type = (formData.get('service_type') as string) || 'general'
  const space_type = (formData.get('space_type') as string) || 'residential'
  const special_notes = (formData.get('special_notes') as string) || null
  const payment_method = (formData.get('payment_method') as string) || 'cash'
  const couch_quantity = parseInt((formData.get('couch_quantity') as string) || '0', 10)
  const mattress_quantity = parseInt((formData.get('mattress_quantity') as string) || '0', 10)

  const property_sqm = parseFloat(sqmRaw)

  if (!branch_id) return { error: 'Please select a branch.' }
  if (!address_street || !address_city || !address_province)
    return { error: 'Please fill in your complete address.' }
  if (!sqmRaw || isNaN(property_sqm) || property_sqm <= 0)
    return { error: 'Please enter a valid property size.' }
  if (!service_date) return { error: 'Please select a service date.' }
  if (!service_time) return { error: 'Please select a service time.' }

  const today = new Date().toISOString().split('T')[0]
  if (service_date <= today) return { error: 'Service date must be at least one day from today.' }

  const { data: booking, error } = await supabase.from('bookings').insert({
    customer_id: user.id,
    branch_id,
    property_sqm,
    service_date,
    service_time,
    address_unit: address_unit || null,
    address_street,
    address_city,
    address_province,
    service_type,
    space_type,
    special_notes,
    payment_method,
    couch_quantity,
    mattress_quantity,
  }).select('id').single()

  if (error) return { error: error.message }

  // Notify customer
  await createNotification({
    userId: user.id,
    title: 'Booking Submitted',
    body: 'Your booking is pending confirmation. We will assign a cleaner shortly.',
    type: 'booking_submitted',
    bookingId: booking.id,
  })

  // Notify admins and branch managers of the selected branch
  const admin = createAdminClient()
  const { data: staff } = await admin
    .from('profiles')
    .select('id')
    .in('role', ['super_admin', 'branch_manager'])
    .or(`branch_id.eq.${branch_id},role.eq.super_admin`)

  for (const s of staff ?? []) {
    await createNotification({
      userId: s.id,
      title: 'New Booking',
      body: `A new ${service_type} booking was submitted for ${service_date}.`,
      type: 'booking_new',
      bookingId: booking.id,
    })
  }

  revalidatePath('/customer')
  revalidatePath('/customer/bookings')
  redirect(`/customer/bookings/${booking.id}?new=true`)
}
