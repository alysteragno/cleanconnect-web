'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
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

// ── Shared input sanitization & validation ─────────────────────────────────

const PH_MOBILE_RE = /^09\d{9}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Trim, strip control characters, collapse whitespace, and cap length. */
function cleanText(value: FormDataEntryValue | null, maxLength: number): string {
  return (typeof value === 'string' ? value : '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function ageInYears(dob: Date): number {
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const monthDiff = now.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--
  return age
}

type CleanerFields = {
  full_name: string
  phone: string
  date_of_birth: string
  address_street: string
  address_city: string
  address_province: string
  emergency_contact_name: string
  emergency_contact_phone: string
  photo_url: string
}

/**
 * Sanitizes and validates the employment details required for a cleaner.
 * Under PH labour requirements these are mandatory (age of majority, contact
 * details, home address, and a reachable emergency contact) — none are optional.
 * Pass `includeName: true` when the name comes from this form (creation);
 * omit it when the name already exists on the profile (conversion).
 * Pass `requirePhoto: true` when a profile photo is mandatory (creation).
 */
function parseCleanerFields(
  formData: FormData,
  opts: { includeName?: boolean; requirePhoto?: boolean } = {}
): { error: string } | { data: CleanerFields } {
  const full_name               = cleanText(formData.get('full_name'), 100)
  const phone                   = cleanText(formData.get('phone'), 11)
  const date_of_birth           = cleanText(formData.get('date_of_birth'), 10)
  const address_street          = cleanText(formData.get('address_street'), 200)
  const address_city            = cleanText(formData.get('address_city'), 100)
  const address_province        = cleanText(formData.get('address_province'), 100)
  const emergency_contact_name  = cleanText(formData.get('emergency_contact_name'), 100)
  const emergency_contact_phone = cleanText(formData.get('emergency_contact_phone'), 11)
  const photo_url               = cleanText(formData.get('photo_url'), 1000)

  if (opts.includeName && full_name.length < 2) return { error: 'Full name is required (at least 2 characters).' }
  if (!PH_MOBILE_RE.test(phone)) return { error: 'A valid Philippine mobile number (09XXXXXXXXX) is required.' }

  if (!date_of_birth) return { error: 'Date of birth is required.' }
  const dob = new Date(date_of_birth + 'T00:00:00')
  if (isNaN(dob.getTime())) return { error: 'Enter a valid date of birth.' }
  const age = ageInYears(dob)
  if (age < 18) return { error: 'Cleaner must be at least 18 years old.' }
  if (age > 100) return { error: 'Enter a valid date of birth.' }

  if (!address_street)   return { error: 'Street address is required.' }
  if (!address_city)     return { error: 'City / municipality is required.' }
  if (!address_province) return { error: 'Province is required.' }

  if (emergency_contact_name.length < 2) return { error: 'Emergency contact name is required.' }
  if (!PH_MOBILE_RE.test(emergency_contact_phone)) {
    return { error: 'A valid emergency contact mobile number (09XXXXXXXXX) is required.' }
  }
  if (emergency_contact_phone === phone) {
    return { error: 'Emergency contact number must be different from the cleaner’s own number.' }
  }

  if (opts.requirePhoto && !photo_url) return { error: 'A cleaner profile photo is required.' }
  // Only accept photo URLs from our own storage bucket.
  if (photo_url && !photo_url.includes('/cleaner-photos/')) {
    return { error: 'Invalid photo. Please re-upload the cleaner photo.' }
  }

  return {
    data: {
      full_name, phone, date_of_birth, address_street, address_city,
      address_province, emergency_contact_name, emergency_contact_phone, photo_url,
    },
  }
}

// ── Cleaner photo upload ───────────────────────────────────────────────────
// Uploads to the public `cleaner-photos` bucket and returns the public URL.
// The URL is carried into the create/edit form via a hidden field.

const CLEANER_PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

export async function uploadCleanerPhoto(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'No image selected.' }
  if (!CLEANER_PHOTO_MIME.has(file.type)) return { error: 'Photo must be a JPEG, PNG, or WebP image.' }
  if (file.size > MAX_PHOTO_BYTES) return { error: 'Photo must be under 5 MB.' }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('cleaner-photos')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) return { error: uploadError.message }

  const { data } = admin.storage.from('cleaner-photos').getPublicUrl(path)
  return { url: data.publicUrl }
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

  const email = cleanText(formData.get('email'), 254).toLowerCase()
  const password = formData.get('password') as string
  const confirm_password = formData.get('confirm_password') as string

  if (!EMAIL_RE.test(email))            return { error: 'A valid email address is required.' }
  if (!password)                        return { error: 'Password is required.' }
  if (password !== confirm_password)     return { error: 'Passwords do not match.' }
  if (password.length < 8)              return { error: 'Password must be at least 8 characters.' }
  if (!/[A-Z]/.test(password))          return { error: 'Password must contain at least one uppercase letter.' }
  if (!/[a-z]/.test(password))          return { error: 'Password must contain at least one lowercase letter.' }
  if (!/[0-9]/.test(password))          return { error: 'Password must contain at least one number.' }
  if (!/[^A-Za-z0-9]/.test(password))  return { error: 'Password must contain at least one special character.' }

  // All cleaner employment details are mandatory (PH labour requirements),
  // including a profile photo.
  const parsed = parseCleanerFields(formData, { includeName: true, requirePhoto: true })
  if ('error' in parsed) return { error: parsed.error }
  const f = parsed.data

  const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (signUpError) return { error: signUpError.message }
  if (!signUpData.user) return { error: 'Failed to create user account.' }

  const { error: profileError } = await adminClient.from('profiles').insert({
    id: signUpData.user.id,
    full_name: f.full_name,
    phone: f.phone,
    role: 'cleaner',
    is_active: true,
    address_street: f.address_street,
    address_city: f.address_city,
    address_province: f.address_province,
    date_of_birth: f.date_of_birth,
    emergency_contact_name: f.emergency_contact_name,
    emergency_contact_phone: f.emergency_contact_phone,
    photo_url: f.photo_url,
  })

  if (profileError) {
    // Roll back the orphaned auth user so the email can be reused.
    await adminClient.auth.admin.deleteUser(signUpData.user.id)
    return { error: profileError.message }
  }

  revalidatePath('/admin/cleaners')
  redirect(`${await getBasePath()}/cleaners`)
}

// ── Convert an existing customer into a cleaner ────────────────────────────
// The customer already has a login; we upgrade their role and capture the
// employment details PH law requires before they can be dispatched.

export async function convertCustomerToCleaner(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const customer_id = cleanText(formData.get('customer_id'), 64)
  if (!customer_id) return { error: 'Missing customer.' }

  const adminClient = createAdminClient()

  // Confirm the target is currently a customer before touching the role.
  const { data: target } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', customer_id)
    .single()

  if (!target) return { error: 'Customer not found.' }
  if (target.role === 'cleaner') return { error: 'This account is already a cleaner.' }
  if (target.role !== 'customer') return { error: 'Only customer accounts can be converted.' }

  const parsed = parseCleanerFields(formData, { includeName: true, requirePhoto: true })
  if ('error' in parsed) return { error: parsed.error }
  const f = parsed.data

  const { error } = await adminClient
    .from('profiles')
    .update({
      role: 'cleaner',
      is_active: true,
      full_name: f.full_name,
      phone: f.phone,
      address_street: f.address_street,
      address_city: f.address_city,
      address_province: f.address_province,
      date_of_birth: f.date_of_birth,
      emergency_contact_name: f.emergency_contact_name,
      emergency_contact_phone: f.emergency_contact_phone,
      photo_url: f.photo_url,
    })
    .eq('id', customer_id)
    .eq('role', 'customer') // guard against a concurrent role change

  if (error) return { error: error.message }

  revalidatePath('/admin/customers')
  revalidatePath(`/admin/customers/${customer_id}`)
  revalidatePath('/admin/cleaners')
  redirect(`${await getBasePath()}/cleaners/${customer_id}`)
}

export async function updateCleanerProfile(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const cleaner_id = formData.get('cleaner_id') as string
  const home_lat_raw = (formData.get('home_lat') as string)?.trim()
  const home_lng_raw = (formData.get('home_lng') as string)?.trim()
  const home_lat = home_lat_raw && !isNaN(parseFloat(home_lat_raw)) ? parseFloat(home_lat_raw) : undefined
  const home_lng = home_lng_raw && !isNaN(parseFloat(home_lng_raw)) ? parseFloat(home_lng_raw) : undefined

  // A cleaner's record must stay complete — same mandatory fields as creation,
  // including the profile photo.
  const parsed = parseCleanerFields(formData, { includeName: true, requirePhoto: true })
  if ('error' in parsed) return { error: parsed.error }
  const f = parsed.data

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('profiles')
    .update({
      full_name: f.full_name,
      phone: f.phone,
      address_street: f.address_street,
      address_city: f.address_city,
      address_province: f.address_province,
      date_of_birth: f.date_of_birth,
      emergency_contact_name: f.emergency_contact_name,
      emergency_contact_phone: f.emergency_contact_phone,
      photo_url: f.photo_url,
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
  redirect(`${await getBasePath()}/bookings/${bookingId}`)
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
  redirect(`${await getBasePath()}/bookings`)
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
  redirect(`${await getBasePath()}/bookings`)
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

// ── Customer search (for manual booking) ──────────────────────────────────

export async function searchCustomers(
  query: string
): Promise<{ id: string; full_name: string; phone: string | null }[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return []

  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('profiles')
    .select('id, full_name, phone')
    .eq('role', 'customer')
    .eq('is_active', true)
    .ilike('full_name', `%${trimmed}%`)
    .order('full_name')
    .limit(10)

  return (data ?? []) as { id: string; full_name: string; phone: string | null }[]
}

// ── Create customer account (for manual booking) ──────────────────────────

export async function createCustomerAccount(
  formData: FormData
): Promise<{ error?: string; customer?: { id: string; full_name: string; phone: string | null } }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const full_name = (formData.get('full_name') as string ?? '').trim().slice(0, 100)
  const email     = (formData.get('email') as string ?? '').trim().toLowerCase()
  const phone     = (formData.get('phone') as string ?? '').trim() || null

  if (!full_name || full_name.length < 2) return { error: 'Full name is required (at least 2 characters).' }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'A valid email is required.' }
  if (phone && !/^09\d{9}$/.test(phone)) return { error: 'Phone must be a valid PH number (09XXXXXXXXX).' }

  // Generate a random temporary password — customer will reset via forgot-password
  const tempPassword = `Tmp${crypto.randomUUID().slice(0, 12)}!`

  const adminClient = createAdminClient()

  const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  })

  if (signUpError) return { error: signUpError.message }
  if (!signUpData.user) return { error: 'Failed to create user account.' }

  const { error: profileError } = await adminClient.from('profiles').insert({
    id: signUpData.user.id,
    full_name,
    phone,
    role: 'customer',
    is_active: true,
  })

  if (profileError) return { error: profileError.message }

  revalidatePath('/admin/customers')
  return { customer: { id: signUpData.user.id, full_name, phone } }
}

// ── Manual booking creation ───────────────────────────────────────────────

// Unit-based services use per-unit pricing (not area-based sqm pricing)
const UNIT_BASED_SLUGS = new Set([
  'grease_trap', 'aircon_cleaning', 'sofa_cleaning', 'aircon_repair',
  'mattress_cleaning', 'grease_trap_installation', 'carpet_cleaning', 'curtain_dry_cleaning',
])

export async function createManualBooking(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const customer_id      = (formData.get('customer_id') as string ?? '').trim()
  const service_name     = (formData.get('service_name') as string ?? '').trim()
  const service_slug     = (formData.get('service_slug') as string ?? '').trim()
  const service_date     = (formData.get('service_date') as string ?? '').trim()
  const service_time     = (formData.get('service_time') as string ?? '').trim()
  const space_type       = (formData.get('space_type') as string ?? '').trim() || 'residential'
  const address_unit     = (formData.get('address_unit') as string ?? '').trim() || null
  const address_street   = (formData.get('address_street') as string ?? '').trim()
  const address_city     = (formData.get('address_city') as string ?? '').trim()
  const address_province = (formData.get('address_province') as string ?? '').trim()
  const special_notes    = (formData.get('special_notes') as string ?? '').trim() || null
  const payment_method   = (formData.get('payment_method') as string ?? '').trim() || 'cash'
  const couch_quantity     = parseInt(formData.get('couch_quantity') as string) || 0
  const mattress_quantity  = parseInt(formData.get('mattress_quantity') as string) || 0
  const furniture_quantity = parseInt(formData.get('furniture_quantity') as string) || 0

  const isUnitBased = UNIT_BASED_SLUGS.has(service_slug)
  const unit_quantity = parseInt(formData.get('unit_quantity') as string) || 1
  const property_sqm_raw = formData.get('property_sqm') as string ?? ''
  const property_sqm = isUnitBased ? 0 : parseFloat(property_sqm_raw)

  // Validation
  if (!customer_id)   return { error: 'Please select or create a customer.' }
  if (!service_name)  return { error: 'Please select a service.' }
  if (!service_date)  return { error: 'Service date is required.' }
  if (!service_time)  return { error: 'Service time is required.' }
  if (!address_street)  return { error: 'Street address is required.' }
  if (!address_city)    return { error: 'City is required.' }
  if (!address_province) return { error: 'Province is required.' }

  // Validate sqm for area-based services
  if (!isUnitBased && (isNaN(property_sqm) || property_sqm <= 0)) {
    return { error: 'Enter a valid property size in sqm.' }
  }

  // Validate unit quantity for unit-based services
  if (isUnitBased && unit_quantity < 1) {
    return { error: 'Quantity must be at least 1.' }
  }

  // Service hours: 8:00 AM – 5:00 PM
  if (service_time < '08:00' || service_time > '17:00') {
    return { error: 'Service time must be between 8:00 AM and 5:00 PM.' }
  }

  const validPayments = ['cash', 'gcash', 'maya', 'bank_transfer', 'bank_check']
  if (!validPayments.includes(payment_method)) return { error: 'Invalid payment method.' }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (new Date(service_date + 'T00:00:00') < today) return { error: 'Service date cannot be in the past.' }

  const adminClient = createAdminClient()

  // Verify customer exists
  const { data: customer } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', customer_id)
    .eq('role', 'customer')
    .single()
  if (!customer) return { error: 'Selected customer not found.' }

  // Get branch
  const { data: branch } = await adminClient
    .from('branches')
    .select('id')
    .limit(1)
    .single()
  if (!branch) return { error: 'No branch configured. Please set up a branch first.' }

  // Insert booking
  // For area-based: DB trigger auto-calculates duration, price, required_cleaners from property_sqm
  // For unit-based: we insert with property_sqm=0, trigger sets ₱1000 default, then we override
  const { data: newBooking, error: insertError } = await adminClient
    .from('bookings')
    .insert({
      customer_id,
      branch_id: branch.id,
      service_name,
      service_date,
      service_time,
      space_type,
      property_sqm: isUnitBased ? 0 : property_sqm,
      address_unit,
      address_street,
      address_city,
      address_province,
      special_notes,
      payment_method,
      couch_quantity,
      mattress_quantity,
      furniture_quantity,
    })
    .select('id')
    .single()

  if (insertError) return { error: insertError.message }
  if (!newBooking) return { error: 'Booking created but failed to retrieve ID.' }

  // For unit-based services: override the trigger-set price with correct per-unit pricing
  if (isUnitBased) {
    const { data: svc } = await adminClient
      .from('services')
      .select('price_from')
      .eq('slug', service_slug)
      .single()

    const unitPrice = svc?.price_from ?? 0
    await adminClient
      .from('bookings')
      .update({
        base_price: unitPrice * unit_quantity,
        required_cleaners: 1,
        duration_hours: unit_quantity <= 2 ? 1 : Math.ceil(unit_quantity * 0.5),
      })
      .eq('id', newBooking.id)
  }

  // Notify customer
  const dateStr = new Date(service_date + 'T00:00:00')
    .toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })

  await createNotification({
    userId: customer_id,
    title: 'Booking Created',
    body: `A ${service_name} booking has been created for you on ${dateStr}.`,
    type: 'booking_confirmed',
    bookingId: newBooking.id,
  })

  revalidatePath('/admin/bookings')
  revalidatePath('/admin')
  redirect(`${await getBasePath()}/bookings/${newBooking.id}`)
}
