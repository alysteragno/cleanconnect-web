'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

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

  const { error } = await supabase.from('bookings').insert({
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
  })

  if (error) return { error: error.message }

  revalidatePath('/customer')
  revalidatePath('/customer/bookings')
  redirect('/customer?booked=true')
}
