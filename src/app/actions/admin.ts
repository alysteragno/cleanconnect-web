'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import { createNotification } from './notifications'
import { estimateBookingPrice, estimateDurationHours, serviceNeedsSqm } from '@/lib/booking-pricing'
import { findConflictingCleaners } from '@/lib/ai-assignment'
import { SPACE_TYPES, METRO_MANILA_CITIES, PAYMENT_METHODS } from '@/lib/booking-constants'
import { getUpcomingAssignedJobCount } from '@/lib/cleaner-jobs'

export type AdminActionState = { error?: string; success?: string; fieldErrors?: Record<string, string> } | undefined

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
// Deliberately narrower than the full WHATWG/HTML5 email grammar: local part
// is restricted to letters, digits, and . _ - + (no <, >, spaces, or the
// other RFC-legal-but-rarely-used symbols like ! # $ % & ' * = ? ^ ` { | } ~).
// Domain must be dot-separated labels that each start/end alphanumeric (so
// "-bad.com" and "x..com" are rejected) with a required TLD — "user@localhost"
// doesn't validate.
const EMAIL_RE = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
/** Letters (incl. accented PH names), digits, spaces, and common address punctuation only — no <, @, %, or other markup/injection characters. */
const ADDRESS_TEXT_RE = /^[a-zA-Z0-9À-ÿ.,'#\-\/() ]+$/
/** Letters (incl. accented PH names), spaces, periods, apostrophes, and hyphens only. */
const NAME_TEXT_RE = /^[a-zA-ZÀ-ÿ' .\-]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/
/** Roughly the Philippines' bounding box — cheap sanity check on submitted coordinates. */
const PH_LAT_RANGE = [4, 21.5] as const
const PH_LNG_RANGE = [116, 127] as const

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

// Every character EMAIL_RE allows anywhere in an address (local part's
// charset is a superset of the domain's), used below to point out exactly
// which character broke validation instead of just saying "invalid".
const EMAIL_ALLOWED_CHAR_RE = /[a-zA-Z0-9._+@-]/

/**
 * Diagnoses exactly why an email failed EMAIL_RE instead of a blanket
 * "invalid email" — checked in order from "most likely what the admin
 * actually typed wrong" (a stray character like < or a missing @) down to
 * domain formatting edge cases.
 */
function describeEmailError(email: string): string {
  if (!email) return 'Email is required.'
  if (/\s/.test(email)) return 'Email cannot contain spaces.'

  const badChars = [...new Set([...email].filter((c) => !EMAIL_ALLOWED_CHAR_RE.test(c)))]
  if (badChars.length > 0) {
    return `Email contains characters that aren't allowed: ${badChars.join(' ')}`
  }

  const atCount = (email.match(/@/g) ?? []).length
  if (atCount === 0) return 'Email must contain an @ symbol, e.g. name@example.com.'
  if (atCount > 1) return 'Email must contain only one @ symbol.'

  const [local, domain] = email.split('@')
  if (!local) return 'Enter the part of the email before the @ symbol.'
  if (!domain) return 'Enter a domain after the @ symbol, e.g. example.com.'
  if (!domain.includes('.')) return 'Domain must include an extension, e.g. .com.'
  if (/^[.-]|[.-]$|\.\.|-\.|\.-/.test(domain)) return 'Enter a valid domain, e.g. example.com.'

  return 'Enter a valid email address, e.g. name@example.com.'
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
 *
 * Collects every problem across all fields (rather than stopping at the
 * first) so the caller can point out everything wrong with the submission
 * in one pass instead of the admin fixing one field, resubmitting, and
 * hitting the next.
 */
function parseCleanerFields(
  formData: FormData,
  opts: { includeName?: boolean; requirePhoto?: boolean } = {}
): { fieldErrors: Record<string, string> } | { data: CleanerFields } {
  const full_name               = cleanText(formData.get('full_name'), 100)
  const phone                   = cleanText(formData.get('phone'), 11)
  const date_of_birth           = cleanText(formData.get('date_of_birth'), 10)
  const address_street          = cleanText(formData.get('address_street'), 200)
  const address_city            = cleanText(formData.get('address_city'), 100)
  const address_province        = cleanText(formData.get('address_province'), 100)
  const emergency_contact_name  = cleanText(formData.get('emergency_contact_name'), 100)
  const emergency_contact_phone = cleanText(formData.get('emergency_contact_phone'), 11)
  const photo_url               = cleanText(formData.get('photo_url'), 1000)

  const fieldErrors: Record<string, string> = {}

  if (opts.includeName) {
    if (full_name.length < 2) fieldErrors.full_name = 'Full name is required (at least 2 characters).'
    else if (!NAME_TEXT_RE.test(full_name)) fieldErrors.full_name = 'Only letters, spaces, apostrophes, and hyphens are allowed.'
  }

  if (!PH_MOBILE_RE.test(phone)) fieldErrors.phone = 'Enter a valid Philippine mobile number (09XXXXXXXXX).'

  if (!date_of_birth) {
    fieldErrors.date_of_birth = 'Date of birth is required.'
  } else {
    const dob = new Date(date_of_birth + 'T00:00:00')
    if (isNaN(dob.getTime())) {
      fieldErrors.date_of_birth = 'Enter a valid date of birth.'
    } else {
      const age = ageInYears(dob)
      if (age < 18) fieldErrors.date_of_birth = 'Cleaner must be at least 18 years old.'
      else if (age > 100) fieldErrors.date_of_birth = 'Enter a valid date of birth.'
    }
  }

  if (!address_street) fieldErrors.address_street = 'Street address is required.'
  else if (!ADDRESS_TEXT_RE.test(address_street)) fieldErrors.address_street = 'Contains unsupported characters.'

  if (!address_city) fieldErrors.address_city = 'City / municipality is required.'
  else if (!ADDRESS_TEXT_RE.test(address_city)) fieldErrors.address_city = 'Contains unsupported characters.'

  if (!address_province) fieldErrors.address_province = 'Province is required.'
  else if (!ADDRESS_TEXT_RE.test(address_province)) fieldErrors.address_province = 'Contains unsupported characters.'

  if (emergency_contact_name.length < 2) fieldErrors.emergency_contact_name = 'Emergency contact name is required.'
  else if (!NAME_TEXT_RE.test(emergency_contact_name)) fieldErrors.emergency_contact_name = 'Only letters, spaces, apostrophes, and hyphens are allowed.'

  if (!PH_MOBILE_RE.test(emergency_contact_phone)) {
    fieldErrors.emergency_contact_phone = 'Enter a valid Philippine mobile number (09XXXXXXXXX).'
  } else if (emergency_contact_phone === phone) {
    fieldErrors.emergency_contact_phone = 'Must be different from the cleaner’s own number.'
  }

  if (opts.requirePhoto && !photo_url) {
    fieldErrors.photo = 'A cleaner profile photo is required.'
  } else if (photo_url && !photo_url.includes('/cleaner-photos/')) {
    // Only accept photo URLs from our own storage bucket.
    fieldErrors.photo = 'Invalid photo. Please re-upload the cleaner photo.'
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

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

  // All cleaner employment details are mandatory (PH labour requirements),
  // including a profile photo.
  const parsed = parseCleanerFields(formData, { includeName: true, requirePhoto: true })
  const fieldErrors: Record<string, string> = 'fieldErrors' in parsed ? { ...parsed.fieldErrors } : {}

  if (!EMAIL_RE.test(email)) fieldErrors.email = describeEmailError(email)

  if (!password) {
    fieldErrors.password = 'Password is required.'
  } else if (password.length < 8) {
    fieldErrors.password = 'Password must be at least 8 characters.'
  } else if (!/[A-Z]/.test(password)) {
    fieldErrors.password = 'Password must contain at least one uppercase letter.'
  } else if (!/[a-z]/.test(password)) {
    fieldErrors.password = 'Password must contain at least one lowercase letter.'
  } else if (!/[0-9]/.test(password)) {
    fieldErrors.password = 'Password must contain at least one number.'
  } else if (!/[^A-Za-z0-9]/.test(password)) {
    fieldErrors.password = 'Password must contain at least one special character.'
  }

  if (!confirm_password) fieldErrors.confirm_password = 'Please re-enter the password.'
  else if (password && password !== confirm_password) fieldErrors.confirm_password = 'Passwords do not match.'

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Please fix the highlighted fields below.', fieldErrors }
  }
  const f = (parsed as { data: CleanerFields }).data

  // email_confirm: false — the cleaner must confirm their email before they
  // can sign in at all; Supabase's Auth layer blocks sign-in for
  // unconfirmed accounts on its own, so no app-side gating is needed for
  // that part. The account is still created with the password the admin
  // just set, so nothing else about account setup waits on confirmation.
  const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  })

  if (signUpError) {
    const isDuplicate = /already (been )?registered|already exists/i.test(signUpError.message)
    return {
      error: isDuplicate ? 'This email is already registered.' : signUpError.message,
      fieldErrors: isDuplicate ? { email: 'This email is already registered.' } : undefined,
    }
  }
  if (!signUpData.user) return { error: 'Failed to create user account.' }

  // A DB trigger auto-provisions a bare profiles row (empty full_name, role
  // 'customer') the instant auth.users gets the new row — upsert so this
  // real data overwrites that stub instead of colliding with it.
  const { error: profileError } = await adminClient.from('profiles').upsert({
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

  // createUser() never sends email on its own regardless of email_confirm —
  // resend() is what actually triggers Supabase's "Confirm signup" template
  // (a genuinely different email from the "Reset Password" one used
  // elsewhere) for the still-unconfirmed account just created above.
  // Non-blocking: if this fails to send, the account still exists and the
  // admin can be told to have the cleaner use "Resend confirmation" (or the
  // admin can re-trigger this) rather than losing the whole submission.
  await supabase.auth.resend({ type: 'signup', email })

  revalidatePath('/admin/cleaners')
  return {
    success: `Cleaner account created. ${f.full_name} must confirm their email (${email}) before they can sign in — a confirmation link has been sent to that address.`,
  }
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
  if ('fieldErrors' in parsed) return { error: 'Please fix the highlighted fields below.', fieldErrors: parsed.fieldErrors }
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
  if ('fieldErrors' in parsed) return { error: 'Please fix the highlighted fields below.', fieldErrors: parsed.fieldErrors }
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

// Deactivating just flips profiles.is_active — the cleaners list page
// already splits Active/Deactivated on this column, and the AI dispatch
// pool query (src/lib/ai-assignment.ts) already filters is_active = true,
// so a deactivated cleaner stops being offered new jobs automatically.
export async function toggleCleanerStatus(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const cleaner_id = formData.get('cleaner_id') as string
  const current = formData.get('is_active') === 'true'

  // Service-role client — the regular client can silently no-op this update
  // if the "Super admins can update any profile" RLS policy isn't present
  // (or isn't matching) on the live DB, same class of issue documented on
  // deleteBooking above.
  const admin = createAdminClient()

  // Deactivating logs the cleaner out and drops them from the AI dispatch
  // pool, but doesn't touch cleaner_assignments — a cleaner with upcoming
  // assigned jobs must be reassigned first, or those bookings are left
  // pointing at someone who can no longer be dispatched. Hard block rather
  // than warn-and-proceed: checked server-side (not just hidden in the UI)
  // since this is what actually prevents an orphaned booking, not merely a
  // client-side nicety.
  if (current) {
    const upcomingCount = await getUpcomingAssignedJobCount(admin, cleaner_id)
    if (upcomingCount > 0) {
      return {
        error: `This cleaner has ${upcomingCount} upcoming assigned job${upcomingCount > 1 ? 's' : ''}. Reassign ${upcomingCount > 1 ? 'them' : 'it'} from Bookings before deactivating.`,
      }
    }
  }

  const { error } = await admin
    .from('profiles')
    .update({ is_active: !current, deactivated_at: current ? new Date().toISOString() : null })
    .eq('id', cleaner_id)

  if (error) return { error: error.message }

  revalidatePath(`/admin/cleaners/${cleaner_id}`)
  revalidatePath('/admin/cleaners')
  revalidatePath('/admin/cleaners/archive')
  return { success: current ? 'Cleaner deactivated.' : 'Cleaner reactivated.' }
}

// Permanently removes the auth user — ON DELETE CASCADE on profiles.id then
// removes the profile row and, in turn, every cleaner_assignments row tied
// to this cleaner (their job-history record is erased; the bookings
// themselves are untouched, since bookings.customer_id is a separate FK).
// Available regardless of active/inactive status — the confirmation panel
// in DeleteCleanerButton is the only guard against an accidental click.
export async function deleteCleanerAccount(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const cleaner_id = formData.get('cleaner_id') as string
  if (!cleaner_id) return { error: 'Missing cleaner.' }

  const adminClient = createAdminClient()

  const { data: target } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', cleaner_id)
    .single()

  if (!target) return { error: 'Cleaner not found.' }
  if (target.role !== 'cleaner') return { error: 'This account is not a cleaner.' }

  const { error } = await adminClient.auth.admin.deleteUser(cleaner_id)
  if (error) return { error: error.message }

  revalidatePath('/admin/cleaners')
  revalidatePath('/admin/cleaners/archive')
  redirect(`${await getBasePath()}/cleaners`)
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

  // Service-role client — see the note on toggleCleanerStatus above; the
  // regular client can silently no-op this update depending on live RLS.
  const admin = createAdminClient()
  const { error } = await admin
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

  const conflicts = await findConflictingCleaners(bookingId, cleanerIds)
  if (conflicts.length > 0) {
    return { error: `${conflicts.map((c) => c.fullName).join(', ')} already ${conflicts.length === 1 ? 'has' : 'have'} an overlapping booking around this time.` }
  }

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

  const conflicts = await findConflictingCleaners(bookingId, cleanerIds)
  if (conflicts.length > 0) {
    return { error: `${conflicts.map((c) => c.fullName).join(', ')} already ${conflicts.length === 1 ? 'has' : 'have'} an overlapping booking around this time.` }
  }

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

/** Full list of active customers, for the "browse all" dropdown on manual booking. */
export async function listCustomers(): Promise<{ id: string; full_name: string; phone: string | null }[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return []

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('profiles')
    .select('id, full_name, phone')
    .eq('role', 'customer')
    .eq('is_active', true)
    .order('full_name')

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
  const phone     = (formData.get('phone') as string ?? '').trim()

  if (!full_name || full_name.length < 2) return { error: 'Full name is required (at least 2 characters).' }
  if (!NAME_TEXT_RE.test(full_name)) return { error: 'Full name contains unsupported characters.' }
  if (!EMAIL_RE.test(email)) return { error: describeEmailError(email) }
  if (!phone || !PH_MOBILE_RE.test(phone)) return { error: 'A valid PH phone number is required (09XXXXXXXXX).' }

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

  // A DB trigger auto-provisions a bare profiles row (empty full_name, role
  // 'customer') the instant auth.users gets the new row — upsert so this
  // real data overwrites that stub instead of colliding with it.
  const { error: profileError } = await adminClient.from('profiles').upsert({
    id: signUpData.user.id,
    full_name,
    phone,
    role: 'customer',
    is_active: true,
  })

  if (profileError) return { error: profileError.message }

  // Send the customer a "set your password" email so they can log in themselves —
  // the tempPassword above is never shown or handed to anyone.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  })

  revalidatePath('/admin/customers')
  return { customer: { id: signUpData.user.id, full_name, phone } }
}

// ── Manual booking creation ───────────────────────────────────────────────

// Extension is derived from the validated MIME type, never the client-supplied
// filename — a filename like "shell.php.jpg" or "photo.exe" can't smuggle an
// unexpected extension into storage this way.
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
}
const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8MB
const MAX_FURNITURE_IMAGES = 10

async function uploadBookingFile(
  bucket: 'furniture-photos',
  file: File,
  prefix: string
): Promise<{ url: string | null; error?: string }> {
  const ext = ALLOWED_IMAGE_TYPES[file.type]
  if (!ext) return { url: null, error: 'Photos must be JPEG, PNG, WEBP, or GIF images.' }
  if (file.size > MAX_IMAGE_BYTES) return { url: null, error: 'Each photo must be 8MB or smaller.' }

  const admin = createAdminClient()
  const path = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage.from(bucket).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })
  if (error) return { url: null, error: error.message }

  const { data: { publicUrl } } = admin.storage.from(bucket).getPublicUrl(path)
  return { url: publicUrl }
}

// Lets the booking form mark dates/times the selected customer is already
// booked on — directly on the calendar and time picker — instead of only
// finding out after submitting. Purely advisory — createManualBooking below
// re-checks the exact same thing at write time regardless of what this
// returns, since this list can go stale the moment another tab/admin books
// a slot for this customer.
export async function getCustomerBookingSlots(
  customerId: string
): Promise<{ date: string; time: string }[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return []
  if (!UUID_RE.test(customerId)) return []

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('bookings')
    .select('service_date, service_time')
    .eq('customer_id', customerId)
    .neq('status', 'cancelled')
    // A far-past customer history isn't useful here and only grows the
    // payload — the calendar never lets anyone pick a past date anyway.
    .gte('service_date', new Date().toISOString().slice(0, 10))

  return (data ?? []).map((b: { service_date: string; service_time: string }) => ({
    date: b.service_date,
    time: b.service_time.slice(0, 5),
  }))
}

export async function createManualBooking(
  state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const customer_id      = (formData.get('customer_id') as string ?? '').trim()
  const service_id       = (formData.get('service_id') as string ?? '').trim()
  const service_date     = (formData.get('service_date') as string ?? '').trim()
  const service_time     = (formData.get('service_time') as string ?? '').trim()
  const space_type       = (formData.get('space_type') as string ?? '').trim() || 'residential'
  const address_unit     = cleanText(formData.get('address_unit'), 50)
  const address_street   = cleanText(formData.get('address_street'), 150)
  const address_barangay = cleanText(formData.get('address_barangay'), 100)
  const address_city     = cleanText(formData.get('address_city'), 100)
  const address_province = cleanText(formData.get('address_province'), 100)
  const special_notes    = cleanText(formData.get('special_notes'), 500) || null
  const other_furniture  = cleanText(formData.get('other_furniture'), 200) || null
  const payment_method    = (formData.get('payment_method') as string ?? '').trim() || 'cash'

  const service_lat_raw = (formData.get('service_lat') as string ?? '').trim()
  const service_lng_raw = (formData.get('service_lng') as string ?? '').trim()
  const service_lat = service_lat_raw ? parseFloat(service_lat_raw) : null
  const service_lng = service_lng_raw ? parseFloat(service_lng_raw) : null

  const sqm_raw          = (formData.get('property_sqm') as string ?? '').trim()
  const sofa_seaters_raw = (formData.get('sofa_seaters') as string ?? '').trim()

  // Validation — every one of these is re-checked here regardless of what
  // the client sanitizes, filters, or disables, since a request can always
  // hit this server action directly (curl/fetch), bypassing the form's UI
  // entirely.
  if (!customer_id || !UUID_RE.test(customer_id)) return { error: 'Please select or create a customer.' }
  if (!service_id || !UUID_RE.test(service_id))   return { error: 'Please select a service.' }
  if (!service_date || !DATE_RE.test(service_date)) return { error: 'Service date is required.' }
  if (!service_time || !TIME_RE.test(service_time)) return { error: 'Service time is required.' }
  if (!address_unit)     return { error: 'Unit / suite is required.' }
  if (!address_street)   return { error: 'Street address is required.' }
  if (!address_barangay) return { error: 'Barangay is required.' }
  if (!address_city)     return { error: 'City is required.' }
  if (!address_province) return { error: 'Province is required.' }

  if (
    !ADDRESS_TEXT_RE.test(address_unit) ||
    !ADDRESS_TEXT_RE.test(address_street) ||
    !ADDRESS_TEXT_RE.test(address_barangay) ||
    !ADDRESS_TEXT_RE.test(address_province)
  ) {
    return { error: 'Address contains unsupported characters.' }
  }
  if (special_notes && /[<>]/.test(special_notes)) return { error: 'Special notes contain unsupported characters.' }
  if (other_furniture && /[<>]/.test(other_furniture)) return { error: 'Other furniture contains unsupported characters.' }

  // City is a fixed dropdown in the UI — re-check against the same list
  // server-side instead of trusting free text from a direct request.
  if (!(METRO_MANILA_CITIES as readonly string[]).includes(address_city)) {
    return { error: 'Selected city is not a supported service area.' }
  }
  if (!SPACE_TYPES.some((s) => s.value === space_type)) return { error: 'Invalid space type.' }

  // Service hours: 8:00 AM – 5:00 PM
  if (service_time < '08:00' || service_time > '17:00') {
    return { error: 'Service time must be between 8:00 AM and 5:00 PM.' }
  }

  // No service on Sundays.
  if (new Date(`${service_date}T00:00:00`).getDay() === 0) {
    return { error: 'Bookings are not available on Sundays.' }
  }

  if (!PAYMENT_METHODS.some((p) => p.value === payment_method)) return { error: 'Invalid payment method.' }

  // Bookings must be scheduled at least 24 hours ahead — no same-day or past bookings.
  const serviceDateTime = new Date(`${service_date}T${service_time}:00`)
  const minBookable = new Date(Date.now() + 24 * 60 * 60 * 1000)
  if (isNaN(serviceDateTime.getTime()) || serviceDateTime < minBookable) {
    return { error: 'Bookings must be scheduled at least 24 hours in advance.' }
  }

  if (service_lat != null && (isNaN(service_lat) || service_lat < PH_LAT_RANGE[0] || service_lat > PH_LAT_RANGE[1])) {
    return { error: 'Invalid service location coordinates.' }
  }
  if (service_lng != null && (isNaN(service_lng) || service_lng < PH_LNG_RANGE[0] || service_lng > PH_LNG_RANGE[1])) {
    return { error: 'Invalid service location coordinates.' }
  }

  const adminClient = createAdminClient()

  const { data: customer } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', customer_id)
    .eq('role', 'customer')
    .single()
  if (!customer) return { error: 'Selected customer not found.' }

  // No double-booking the same customer into the same date + time slot.
  // Cancelled bookings don't count — the slot is free again once cancelled.
  const { data: duplicateBooking } = await adminClient
    .from('bookings')
    .select('id')
    .eq('customer_id', customer_id)
    .eq('service_date', service_date)
    .eq('service_time', service_time)
    .neq('status', 'cancelled')
    .limit(1)
    .maybeSingle()
  if (duplicateBooking) {
    return { error: 'This customer already has a booking on this date and time. Pick a different date or time.' }
  }

  const { data: service } = await adminClient
    .from('services')
    .select('slug, name, starting_price, image_url')
    .eq('id', service_id)
    .eq('is_active', true)
    .single()
  if (!service) return { error: 'Selected service not found.' }

  // Only the 5 general/area-priced services need a property size; everyone else
  // is flat/unit-priced. bookings.property_sqm is NOT NULL with no default on
  // the live schema, so non-sqm services still insert 0 (matches prior convention).
  const needsSqm = serviceNeedsSqm(service.slug)
  const property_sqm = needsSqm ? parseFloat(sqm_raw) : 0
  if (needsSqm && (isNaN(property_sqm) || property_sqm <= 0 || property_sqm > 2000)) {
    return { error: 'Enter a valid property size in sqm (1–2000).' }
  }

  const isSofa = service.slug === 'sofa_couch_deep_cleaning'
  let sofa_seaters: number | null = null
  if (isSofa && sofa_seaters_raw) {
    const parsed = parseInt(sofa_seaters_raw, 10)
    if (isNaN(parsed) || parsed < 0 || parsed > 20) {
      return { error: 'Enter a valid number of sofa seaters (0–20).' }
    }
    sofa_seaters = parsed
  }

  // Furniture photos are optional for a phone-in/walk-in booking
  const furnitureFiles = formData.getAll('furniture_images').filter(
    (f): f is File => f instanceof File && f.size > 0
  )
  if (furnitureFiles.length > MAX_FURNITURE_IMAGES) {
    return { error: `You can upload at most ${MAX_FURNITURE_IMAGES} photos.` }
  }
  const furniture_images: string[] = []
  for (const file of furnitureFiles) {
    const result = await uploadBookingFile('furniture-photos', file, 'furniture')
    if (result.error) return { error: result.error }
    if (result.url) furniture_images.push(result.url)
  }

  const base_price     = estimateBookingPrice(service.slug, needsSqm ? property_sqm : 0, Number(service.starting_price))
  const duration_hours = estimateDurationHours(service.slug, needsSqm ? property_sqm : 0)

  // Insert booking. The apply_cleanconnect_operational_rules() trigger fires
  // BEFORE INSERT and overwrites base_price/duration_hours/required_cleaners
  // from the raw property_sqm tiering — we correct them with a follow-up
  // UPDATE that doesn't touch property_sqm, so the trigger's UPDATE-OF-sqm
  // condition never re-fires and our service-catalog pricing sticks.
  const { data: newBooking, error: insertError } = await adminClient
    .from('bookings')
    .insert({
      customer_id,
      service_slug: service.slug,
      service_name: service.name,
      service_image: service.image_url,
      space_type,
      property_sqm: needsSqm ? property_sqm : 0,
      sofa_seaters,
      other_furniture,
      furniture_images: furniture_images.length > 0 ? furniture_images : null,
      address_unit,
      address_street,
      address_barangay,
      address_city,
      address_province,
      service_lat,
      service_lng,
      service_date,
      service_time,
      payment_method,
      special_notes,
      status: 'pending',
      payment_status: 'unpaid',
      base_price,
      required_cleaners: 1,
      duration_hours,
    })
    .select('id')
    .single()

  if (insertError) return { error: insertError.message }
  if (!newBooking) return { error: 'Booking created but failed to retrieve ID.' }

  await adminClient
    .from('bookings')
    .update({ base_price, duration_hours, required_cleaners: 1 })
    .eq('id', newBooking.id)

  // Notify customer
  const dateStr = new Date(service_date + 'T00:00:00')
    .toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })

  await createNotification({
    userId: customer_id,
    title: 'Booking Created',
    body: `A ${service.name} booking has been created for you on ${dateStr}.`,
    type: 'booking_confirmed',
    bookingId: newBooking.id,
  })

  // Phone-in/walk-in bookings are created from a typed address only — ask the
  // customer to pin their exact GPS location in the app for accuracy, since a
  // geocoded address is far less precise than a device-pinned location.
  if (service_lat == null || service_lng == null) {
    await createNotification({
      userId: customer_id,
      title: 'Pin Your Service Location',
      body: 'For a faster, more accurate arrival, please open this booking in the app and pin your exact service location on the map.',
      type: 'info',
      bookingId: newBooking.id,
    })
  }

  revalidatePath('/admin/bookings')
  revalidatePath('/admin')
  redirect(`${await getBasePath()}/bookings/${newBooking.id}`)
}
