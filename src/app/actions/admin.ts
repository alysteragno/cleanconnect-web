'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'

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
  if (!user || !(await assertSuperAdmin(supabase, user.id))) return { error: 'Unauthorized.' }

  const full_name = (formData.get('full_name') as string).trim()
  const email = (formData.get('email') as string).trim()
  const password = formData.get('password') as string
  const phone = (formData.get('phone') as string).trim() || null
  const branch_id = formData.get('branch_id') as string

  if (!full_name || !email || !password || !branch_id) return { error: 'All fields are required.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const adminClient = createAdminClient()
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
    branch_id,
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
  const branch_id = formData.get('branch_id') as string

  if (!full_name || !branch_id) return { error: 'Name and branch are required.' }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name, phone, branch_id })
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

  revalidatePath(`/admin/bookings/${booking_id}`)
  revalidatePath('/admin/bookings')
  return { success: `Payment status updated to "${payment_status}".` }
}

// ── Cleaner availability override ─────────────────────────────────────────
// Admin and branch managers can set or remove day-offs on behalf of cleaners.
// Uses admin client to bypass the cleaner-only RLS on cleaner_availability.

async function assertStaff(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return data?.role === 'super_admin' || data?.role === 'branch_manager'
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
