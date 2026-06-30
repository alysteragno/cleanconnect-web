'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { createNotification } from './notifications'

export type AdminActionState = { error?: string; success?: string } | undefined

async function assertSuperAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return data?.role === 'super_admin'
}

// ── Cleaner account management ─────────────────────────────────────────────

export async function createCleanerAccount(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Session expired. Please log in again.' }

  const adminClient = createAdminClient()
  const { data: adminProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!adminProfile || adminProfile.role !== 'super_admin') return { error: 'Unauthorized.' }

  const full_name = (formData.get('full_name') as string).trim()
  const email = (formData.get('email') as string).trim()
  const password = formData.get('password') as string
  const confirm_password = formData.get('confirm_password') as string
  const phone = (formData.get('phone') as string).trim() || null
  const address_street           = (formData.get('address_street') as string)?.trim() || null
  const address_city             = (formData.get('address_city') as string)?.trim() || null
  const address_province         = (formData.get('address_province') as string)?.trim() || null
  const date_of_birth            = (formData.get('date_of_birth') as string)?.trim() || null
  const emergency_contact_name   = (formData.get('emergency_contact_name') as string)?.trim() || null
  const emergency_contact_phone  = (formData.get('emergency_contact_phone') as string)?.trim() || null

  if (!full_name || !email || !password) return { error: 'Full name, email, and password are required.' }
  if (password !== confirm_password)     return { error: 'Passwords do not match.' }
  if (password.length < 8)              return { error: 'Password must be at least 8 characters.' }
  if (!/[A-Z]/.test(password))          return { error: 'Password must contain at least one uppercase letter.' }
  if (!/[a-z]/.test(password))          return { error: 'Password must contain at least one lowercase letter.' }
  if (!/[0-9]/.test(password))          return { error: 'Password must contain at least one number.' }
  if (!/[^A-Za-z0-9]/.test(password))  return { error: 'Password must contain at least one special character.' }

  const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (signUpError) return { error: signUpError.message }
  if (!signUpData.user) return { error: 'Failed to create user account.' }

  const { error: profileError } = await adminClient.from('profiles').insert({
    id: signUpData.user.id,
    full_name,
    phone,
    role: 'cleaner',
    is_active: true,
    address_street,
    address_city,
    address_province,
    date_of_birth,
    emergency_contact_name,
    emergency_contact_phone,
  })

  if (profileError) return { error: profileError.message }

  revalidatePath('/admin/cleaners')
  redirect('/admin/cleaners')
}

export async function updateCleanerProfile(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const cleaner_id = formData.get('cleaner_id') as string
  const full_name = (formData.get('full_name') as string).trim()
  const phone = (formData.get('phone') as string).trim() || null
  const address_street           = (formData.get('address_street') as string)?.trim() || null
  const address_city             = (formData.get('address_city') as string)?.trim() || null
  const address_province         = (formData.get('address_province') as string)?.trim() || null
  const date_of_birth            = (formData.get('date_of_birth') as string)?.trim() || null
  const emergency_contact_name   = (formData.get('emergency_contact_name') as string)?.trim() || null
  const emergency_contact_phone  = (formData.get('emergency_contact_phone') as string)?.trim() || null
  const home_lat_raw = (formData.get('home_lat') as string)?.trim()
  const home_lng_raw = (formData.get('home_lng') as string)?.trim()
  const home_lat = home_lat_raw && !isNaN(parseFloat(home_lat_raw)) ? parseFloat(home_lat_raw) : undefined
  const home_lng = home_lng_raw && !isNaN(parseFloat(home_lng_raw)) ? parseFloat(home_lng_raw) : undefined
  if (!full_name) return { error: 'Name is required.' }
  if (phone && !/^09[0-9]{9}$/.test(phone)) return { error: 'Phone must be a valid Philippine mobile number (09XXXXXXXXX).' }
  if (emergency_contact_phone && !/^09[0-9]{9}$/.test(emergency_contact_phone)) return { error: 'Emergency contact phone must be a valid Philippine mobile number (09XXXXXXXXX).' }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('profiles')
    .update({
      full_name,
      phone,
      address_street,
      address_city,
      address_province,
      date_of_birth,
      emergency_contact_name,
      emergency_contact_phone,
      ...(home_lat !== undefined && home_lng !== undefined ? { home_lat, home_lng } : {}),
    })
    .eq('id', cleaner_id)

  if (error) return { error: error.message }

  revalidatePath('/admin/cleaners')
  revalidatePath(`/admin/cleaners/${cleaner_id}`)
  return { success: 'Cleaner profile updated.' }
}


export async function toggleCustomerStatus(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const customer_id = formData.get('customer_id') as string
  const current = formData.get('is_active') === 'true'

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: !current })
    .eq('id', customer_id)

  if (error) return { error: error.message }

  revalidatePath(`/admin/customers/${customer_id}`)
  revalidatePath('/admin/customers')
  return { success: current ? 'Customer deactivated.' : 'Customer reactivated.' }
}

// ── Payment management ─────────────────────────────────────────────────────

export async function updatePaymentStatus(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const booking_id = formData.get('booking_id') as string
  const payment_status = formData.get('payment_status') as string

  const valid = ['unpaid', 'partial', 'paid', 'refunded']
  if (!valid.includes(payment_status)) return { error: 'Invalid payment status.' }

  // Cash payments are confirmed by the cleaner via the mobile app swipe — block web override
  if (payment_status === 'paid') {
    const { data: booking } = await supabase
      .from('bookings')
      .select('payment_method')
      .eq('id', booking_id)
      .single()

    if (booking?.payment_method === 'cash') {
      return { error: 'Cash payments are confirmed by the cleaner via the mobile app.' }
    }
  }

  const { error } = await supabase
    .from('bookings')
    .update({ payment_status })
    .eq('id', booking_id)

  if (error) return { error: error.message }

  if (payment_status === 'paid') {
    const { data: bookingMeta } = await supabase
      .from('bookings')
      .select('customer_id, service_date')
      .eq('id', booking_id)
      .single()

    if (bookingMeta) {
      const dateStr = new Date(bookingMeta.service_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
      await createNotification({
        userId: bookingMeta.customer_id,
        title: 'Payment Confirmed',
        body: `Your payment for the appointment on ${dateStr} has been received. Thank you!`,
        type: 'payment_confirmed',
        bookingId: booking_id,
      })
    }
  }

  revalidatePath(`/admin/bookings/${booking_id}`)
  revalidatePath('/admin/bookings')
  return { success: `Payment status updated to "${payment_status}".` }
}

// ── Booking dispatch & cancellation ───────────────────────────────────────

export async function dispatchCleaners(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const bookingId = formData.get('booking_id') as string
  const cleanerIds = formData.getAll('cleaner_ids') as string[]

  if (!bookingId) return { error: 'Missing booking.' }
  if (cleanerIds.length === 0) return { error: 'Select at least one cleaner.' }

  const rows = cleanerIds.map((cleaner_id) => ({
    booking_id: bookingId,
    cleaner_id,
    status: 'assigned' as const,
  }))

  const admin = createAdminClient()
  const { error } = await admin
    .from('cleaner_assignments')
    .upsert(rows, { onConflict: 'booking_id,cleaner_id', ignoreDuplicates: true })

  if (error) return { error: error.message }

  // Confirm the booking and fetch date + customer for notifications
  const { data: booking } = await admin
    .from('bookings')
    .select('service_date, customer_id, status')
    .eq('id', bookingId)
    .single()

  const wasAlreadyConfirmed = booking?.status === 'confirmed'

  await admin
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', bookingId)

  const dateStr = booking?.service_date
    ? new Date(booking.service_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    : 'an upcoming date'

  const notifications: Promise<void>[] = cleanerIds.map((cleanerId) =>
    createNotification({
      userId: cleanerId,
      title: 'Job Assignment',
      body: `You have been assigned a cleaning job on ${dateStr}.`,
      type: 'job_assigned',
      bookingId,
    })
  )

  if (!wasAlreadyConfirmed && booking?.customer_id) {
    notifications.push(
      createNotification({
        userId: booking.customer_id,
        title: 'Booking Confirmed',
        body: `Your cleaning appointment on ${dateStr} has been confirmed!`,
        type: 'booking_confirmed',
        bookingId,
      })
    )
  }

  await Promise.all(notifications)

  revalidatePath('/admin/bookings')
  revalidatePath(`/admin/bookings/${bookingId}`)
  revalidatePath('/admin')
  return { success: `${cleanerIds.length} cleaner(s) assigned.` }
}

export async function forceAssignCleaner(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const bookingId  = formData.get('booking_id') as string
  const cleanerIds = formData.getAll('cleaner_id') as string[]
  if (!bookingId || cleanerIds.length === 0) return { error: 'Missing booking or cleaner.' }

  const admin = createAdminClient()

  const { error: e1 } = await admin
    .from('cleaner_assignments')
    .upsert(
      cleanerIds.map((cleanerId) => ({ booking_id: bookingId, cleaner_id: cleanerId, status: 'assigned' as const })),
      { onConflict: 'booking_id,cleaner_id' }
    )
  if (e1) return { error: e1.message }

  const { data: booking } = await admin
    .from('bookings')
    .select('service_date, customer_id, status')
    .eq('id', bookingId)
    .single()

  const wasAlreadyConfirmed = booking?.status === 'confirmed'

  const { error: e2 } = await admin
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', bookingId)
  if (e2) return { error: e2.message }

  if (booking) {
    const dateStr = new Date(booking.service_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    await Promise.all([
      ...cleanerIds.map((cleanerId) =>
        createNotification({
          userId: cleanerId,
          title: 'Job Confirmed',
          body: `You have been assigned a cleaning job on ${dateStr}.`,
          type: 'job_assigned',
          bookingId,
        })
      ),
      ...(!wasAlreadyConfirmed ? [createNotification({
        userId: booking.customer_id,
        title: 'Booking Confirmed',
        body: `Your cleaning appointment on ${dateStr} has been confirmed!`,
        type: 'booking_confirmed',
        bookingId,
      })] : []),
    ])
  }

  revalidatePath('/admin/bookings')
  revalidatePath(`/admin/bookings/${bookingId}`)
  revalidatePath('/admin')
  redirect(`/admin/bookings/${bookingId}`)
}

export async function cancelBooking(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const bookingId = formData.get('booking_id') as string
  const feeRaw = formData.get('cancellation_fee') as string
  const cancellation_fee = feeRaw && parseFloat(feeRaw) > 0 ? parseFloat(feeRaw) : null

  const { data: bookingMeta } = await supabase
    .from('bookings')
    .select('customer_id, service_date')
    .eq('id', bookingId)
    .single()

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancellation_fee })
    .eq('id', bookingId)

  if (error) return { error: error.message }

  if (bookingMeta) {
    const dateStr = new Date(bookingMeta.service_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    await createNotification({
      userId: bookingMeta.customer_id,
      title: 'Booking Cancelled',
      body: `Your cleaning appointment on ${dateStr} has been cancelled. Contact us if you have questions.`,
      type: 'booking_cancelled',
      bookingId,
    })
  }

  revalidatePath('/admin/bookings')
  revalidatePath(`/admin/bookings/${bookingId}`)
  redirect('/admin/bookings')
}

// ── Booking deletion ─────────────────────────────────────────────────────

export async function deleteBooking(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const bookingId = formData.get('booking_id') as string
  if (!bookingId) return { error: 'Missing booking.' }

  // Use service-role client — the schema has no FOR DELETE RLS policy for admins,
  // so the regular client silently drops the operation.
  const admin = createAdminClient()
  const { error } = await admin
    .from('bookings')
    .delete()
    .eq('id', bookingId)

  if (error) return { error: error.message }

  revalidatePath('/admin/bookings')
  revalidatePath('/admin')
  redirect('/admin/bookings')
}

// ── Billing adjustment ────────────────────────────────────────────────────

export async function adjustBookingAmount(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const booking_id = formData.get('booking_id') as string
  const raw = formData.get('base_price') as string
  const amount = parseFloat(raw)

  if (!booking_id) return { error: 'Missing booking.' }
  if (isNaN(amount) || amount < 0) return { error: 'Enter a valid amount.' }

  const { error } = await supabase
    .from('bookings')
    .update({ base_price: amount })
    .eq('id', booking_id)

  if (error) return { error: error.message }

  revalidatePath(`/admin/bookings/${booking_id}`)
  revalidatePath('/admin/bookings')
  revalidatePath('/admin')
  return { success: `Billing updated to ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}.` }
}

// ── Cleaners required override ────────────────────────────────────────────

export async function updateRequiredCleaners(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const booking_id = formData.get('booking_id') as string
  const raw = formData.get('required_cleaners') as string
  const count = parseInt(raw, 10)

  if (!booking_id) return { error: 'Missing booking.' }
  if (isNaN(count) || count < 1) return { error: 'Enter a valid number of cleaners.' }

  const { error } = await supabase
    .from('bookings')
    .update({ required_cleaners: count })
    .eq('id', booking_id)

  if (error) return { error: error.message }

  revalidatePath(`/admin/bookings/${booking_id}`)
  return { success: `Cleaners required updated to ${count}.` }
}

// ── Cleaner availability override ─────────────────────────────────────────
// Uses admin client to bypass the cleaner-only RLS on cleaner_availability.

async function assertStaff(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return data?.role === 'super_admin'
}

export async function addCleanerDayOff(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertStaff(supabase, user.id))) return { error: 'Unauthorized.' }

  const cleaner_id = formData.get('cleaner_id') as string
  const unavailable_date = formData.get('unavailable_date') as string
  if (!cleaner_id || !unavailable_date) return { error: 'Date is required.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('cleaner_availability')
    .insert({ cleaner_id, unavailable_date })

  if (error) return { error: error.code === '23505' ? 'That date is already marked.' : error.message }

  revalidatePath(`/admin/cleaners/${cleaner_id}`)
  revalidatePath(`/manager/cleaners/${cleaner_id}`)
  return { success: 'Day-off added.' }
}

export async function removeCleanerDayOff(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertStaff(supabase, user.id))) return { error: 'Unauthorized.' }

  const availability_id = formData.get('availability_id') as string
  const cleaner_id = formData.get('cleaner_id') as string
  if (!availability_id) return { error: 'Missing ID.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('cleaner_availability')
    .delete()
    .eq('id', availability_id)

  if (error) return { error: error.message }

  revalidatePath(`/admin/cleaners/${cleaner_id}`)
  revalidatePath(`/manager/cleaners/${cleaner_id}`)
  return { success: 'Day-off removed.' }
}

// ── Cleaner weekly schedule (read-only, called from calendar UI) ───────────

export async function getCleanerWeekScheduleData(
  weekStart: string,   // ISO date string for Monday of the week
  cleanerIds: string[]
): Promise<{
  dayOffs: Array<{ cleaner_id: string; unavailable_date: string }>
  assignments: Array<{
    cleaner_id: string
    booking_id: string
    service_date: string
    booking_status: string
  }>
}> {
  if (cleanerIds.length === 0) return { dayOffs: [], assignments: [] }

  const end = new Date(weekStart + 'T00:00:00')
  end.setDate(end.getDate() + 6)
  const weekEnd = end.toISOString().slice(0, 10)

  const adminClient = createAdminClient()

  const [{ data: dayOffs }, { data: bookingsInWeek }] = await Promise.all([
    adminClient
      .from('cleaner_availability')
      .select('cleaner_id, unavailable_date')
      .in('cleaner_id', cleanerIds)
      .gte('unavailable_date', weekStart)
      .lte('unavailable_date', weekEnd),
    adminClient
      .from('bookings')
      .select('id, service_date, status')
      .gte('service_date', weekStart)
      .lte('service_date', weekEnd),
  ])

  const bookingMap = new Map((bookingsInWeek ?? []).map(b => [b.id, b]))
  const bookingIds = [...bookingMap.keys()]

  let assignments: Array<{
    cleaner_id: string
    booking_id: string
    service_date: string
    booking_status: string
  }> = []

  if (bookingIds.length > 0) {
    const { data: assignData } = await adminClient
      .from('cleaner_assignments')
      .select('cleaner_id, booking_id')
      .in('booking_id', bookingIds)
      .in('cleaner_id', cleanerIds)

    assignments = (assignData ?? []).map(a => {
      const bk = bookingMap.get(a.booking_id)
      return {
        cleaner_id: a.cleaner_id,
        booking_id: a.booking_id,
        service_date: bk?.service_date ?? '',
        booking_status: bk?.status ?? '',
      }
    })
  }

  return { dayOffs: dayOffs ?? [], assignments }
}

// ── Branch management ──────────────────────────────────────────────────────
// Single-branch only — createBranch is intentionally removed per client policy.

export async function updateBranch(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const branch_id = formData.get('branch_id') as string
  const name = (formData.get('name') as string).trim()
  const region = (formData.get('region') as string).trim()
  const contact_number = (formData.get('contact_number') as string).trim() || null

  if (!name || !region) return { error: 'Branch name and region are required.' }

  const { error } = await supabase
    .from('branches')
    .update({ name, region, contact_number })
    .eq('id', branch_id)

  if (error) return { error: error.message }

  revalidatePath('/admin/branches')
  return { success: 'Branch updated.' }
}
