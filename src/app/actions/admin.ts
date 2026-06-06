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
  const phone = (formData.get('phone') as string).trim() || null

  if (!full_name || !email || !password) return { error: 'All fields are required.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

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

  if (!full_name) return { error: 'Name is required.' }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name, phone })
    .eq('id', cleaner_id)

  if (error) return { error: error.message }

  revalidatePath('/admin/cleaners')
  revalidatePath(`/admin/cleaners/${cleaner_id}`)
  return { success: 'Cleaner profile updated.' }
}

export async function toggleCleanerStatus(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const cleaner_id = formData.get('cleaner_id') as string
  const current = formData.get('is_active') === 'true'

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: !current })
    .eq('id', cleaner_id)

  if (error) return { error: error.message }

  revalidatePath(`/admin/cleaners/${cleaner_id}`)
  revalidatePath('/admin/cleaners')
  return { success: current ? 'Cleaner deactivated.' : 'Cleaner reactivated.' }
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
    status: 'offered' as const,
  }))

  const { error } = await supabase
    .from('cleaner_assignments')
    .upsert(rows, { onConflict: 'booking_id,cleaner_id', ignoreDuplicates: true })

  if (error) return { error: error.message }

  const { data: booking } = await supabase
    .from('bookings')
    .select('service_date')
    .eq('id', bookingId)
    .single()

  const dateStr = booking?.service_date
    ? new Date(booking.service_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    : 'an upcoming date'

  await Promise.all(
    cleanerIds.map((cleanerId) =>
      createNotification({
        userId: cleanerId,
        title: 'New Job Offer',
        body: `You have a cleaning offer for ${dateStr}. Accept or decline in your assignments.`,
        type: 'job_offer',
        bookingId,
      })
    )
  )

  revalidatePath(`/admin/bookings/${bookingId}`)
  return { success: `Offer sent to ${cleanerIds.length} cleaner(s).` }
}

export async function forceAssignCleaner(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const bookingId = formData.get('booking_id') as string
  const cleanerId = formData.get('cleaner_id') as string
  if (!bookingId || !cleanerId) return { error: 'Missing booking or cleaner.' }

  const { error: e1 } = await supabase
    .from('cleaner_assignments')
    .upsert(
      { booking_id: bookingId, cleaner_id: cleanerId, status: 'accepted' },
      { onConflict: 'booking_id,cleaner_id' }
    )
  if (e1) return { error: e1.message }

  const { error: e2 } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', bookingId)
  if (e2) return { error: e2.message }

  const { data: booking } = await supabase
    .from('bookings')
    .select('service_date, customer_id')
    .eq('id', bookingId)
    .single()

  if (booking) {
    const dateStr = new Date(booking.service_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    await Promise.all([
      createNotification({
        userId: cleanerId,
        title: 'Job Confirmed',
        body: `You have been assigned a cleaning job on ${dateStr}.`,
        type: 'job_assigned',
        bookingId,
      }),
      createNotification({
        userId: booking.customer_id,
        title: 'Booking Confirmed',
        body: `Your cleaning appointment on ${dateStr} has been confirmed!`,
        type: 'booking_confirmed',
        bookingId,
      }),
    ])
  }

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
