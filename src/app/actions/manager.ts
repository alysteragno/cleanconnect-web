'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export type ManagerActionState = { error?: string; success?: string } | undefined

async function getManagerBranchId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('branch_id, role')
    .eq('id', userId)
    .single()
  if (!data || (data.role !== 'branch_manager' && data.role !== 'super_admin')) return null
  return data.branch_id as string | null
}

// Dispatch selected cleaners — creates 'offered' assignments for each
export async function dispatchCleaners(
  state: ManagerActionState,
  formData: FormData
): Promise<ManagerActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const bookingId = formData.get('booking_id') as string
  const cleanerIds = formData.getAll('cleaner_ids') as string[]

  if (!bookingId) return { error: 'Missing booking.' }
  if (cleanerIds.length === 0) return { error: 'Select at least one cleaner.' }

  // Verify the booking belongs to the manager's branch
  const branchId = await getManagerBranchId(supabase, user.id)
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, branch_id, status')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'Booking not found.' }
  if (branchId && booking.branch_id !== branchId) return { error: 'Booking is not in your branch.' }

  // Insert offered assignments (ignore duplicates — cleaner may already be offered)
  const rows = cleanerIds.map((cleaner_id) => ({
    booking_id: bookingId,
    cleaner_id,
    status: 'offered' as const,
  }))

  const { error } = await supabase
    .from('cleaner_assignments')
    .upsert(rows, { onConflict: 'booking_id,cleaner_id', ignoreDuplicates: true })

  if (error) return { error: error.message }

  revalidatePath(`/manager/bookings/${bookingId}`)
  return { success: `Offer sent to ${cleanerIds.length} cleaner(s).` }
}

// Force-assign a cleaner — bypasses acceptance, used for manual override
export async function forceAssignCleaner(
  state: ManagerActionState,
  formData: FormData
): Promise<ManagerActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const bookingId = formData.get('booking_id') as string
  const cleanerId = formData.get('cleaner_id') as string

  if (!bookingId || !cleanerId) return { error: 'Missing booking or cleaner.' }

  const branchId = await getManagerBranchId(supabase, user.id)
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, branch_id')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'Booking not found.' }
  if (branchId && booking.branch_id !== branchId) return { error: 'Booking is not in your branch.' }

  // Upsert the assignment as accepted (override any existing offered/declined)
  const { error: e1 } = await supabase
    .from('cleaner_assignments')
    .upsert(
      { booking_id: bookingId, cleaner_id: cleanerId, status: 'accepted' },
      { onConflict: 'booking_id,cleaner_id' }
    )
  if (e1) return { error: e1.message }

  // Confirm the booking
  const { error: e2 } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', bookingId)
  if (e2) return { error: e2.message }

  revalidatePath(`/manager/bookings/${bookingId}`)
  revalidatePath('/manager')
  redirect(`/manager/bookings/${bookingId}`)
}

// Cancel a booking
export async function cancelBooking(
  state: ManagerActionState,
  formData: FormData
): Promise<ManagerActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const bookingId = formData.get('booking_id') as string
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (error) return { error: error.message }

  revalidatePath('/manager/bookings')
  revalidatePath(`/manager/bookings/${bookingId}`)
  redirect('/manager/bookings')
}
