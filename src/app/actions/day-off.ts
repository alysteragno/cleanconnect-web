'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { createNotification } from './notifications'

export type DayOffState = { error?: string; success?: string } | undefined

// ── Cleaner: submit a day-off request ─────────────────────────────────────
export async function submitDayOffRequest(
  state: DayOffState,
  formData: FormData
): Promise<DayOffState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'cleaner') return { error: 'Unauthorized.' }

  const requested_date = (formData.get('requested_date') as string).trim()
  const reason = (formData.get('reason') as string | null)?.trim() || null
  const notes  = (formData.get('notes')  as string | null)?.trim() || null

  if (!requested_date) return { error: 'Please select a date.' }
  if (!reason) return { error: 'Please select a reason.' }

  const today = new Date().toISOString().split('T')[0]
  if (requested_date < today) return { error: 'Cannot request a day off in the past.' }

  const admin = createAdminClient()

  const { error: insertErr } = await admin
    .from('cleaner_day_off_requests')
    .insert({ cleaner_id: user.id, requested_date, reason, notes })

  if (insertErr) {
    if (insertErr.code === '23505') return { error: 'You already have a request for that date.' }
    return { error: 'Failed to submit request. Please try again.' }
  }

  // Notify all super admins
  const { data: admins } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'super_admin')

  for (const a of admins ?? []) {
    await createNotification({
      userId: a.id,
      title: 'Day-Off Request',
      body: `${profile.full_name} requested a day off on ${formatDateShort(requested_date)}.`,
      type: 'day_off_request',
    })
  }

  revalidatePath('/cleaner/day-off')
  return { success: 'Day-off request submitted. Pending admin approval.' }
}

// ── Cleaner: cancel a pending request ─────────────────────────────────────
export async function cancelDayOffRequest(
  state: DayOffState,
  formData: FormData
): Promise<DayOffState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const request_id = (formData.get('request_id') as string).trim()
  if (!request_id) return { error: 'Invalid request.' }

  const admin = createAdminClient()

  // Verify this request belongs to the cleaner and is still pending
  const { data: req } = await admin
    .from('cleaner_day_off_requests')
    .select('id, status')
    .eq('id', request_id)
    .eq('cleaner_id', user.id)
    .single()

  if (!req) return { error: 'Request not found.' }
  if (req.status !== 'pending') return { error: 'Only pending requests can be cancelled.' }

  const { error } = await admin
    .from('cleaner_day_off_requests')
    .delete()
    .eq('id', request_id)

  if (error) return { error: 'Failed to cancel request. Please try again.' }

  revalidatePath('/cleaner/day-off')
  return { success: 'Request cancelled.' }
}

// ── Admin: approve or reject a request ────────────────────────────────────
export async function reviewDayOffRequest(
  state: DayOffState,
  formData: FormData
): Promise<DayOffState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!adminProfile || (adminProfile.role !== 'super_admin' && adminProfile.role !== 'branch_manager')) return { error: 'Unauthorized.' }

  const request_id  = (formData.get('request_id') as string).trim()
  const decision    = formData.get('decision') as 'approved' | 'rejected'
  const admin_notes = (formData.get('admin_notes') as string | null)?.trim() || null

  if (!request_id) return { error: 'Invalid request.' }
  if (decision !== 'approved' && decision !== 'rejected') return { error: 'Invalid decision.' }

  const admin = createAdminClient()

  // Fetch request details to get cleaner_id and date
  const { data: req } = await admin
    .from('cleaner_day_off_requests')
    .select('id, cleaner_id, requested_date, status, profiles!cleaner_id (full_name)')
    .eq('id', request_id)
    .single()

  if (!req) return { error: 'Request not found.' }
  if (req.status !== 'pending') return { error: 'This request has already been reviewed.' }

  // Update the request status
  const { error: updateErr } = await admin
    .from('cleaner_day_off_requests')
    .update({
      status: decision,
      admin_notes,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', request_id)

  if (updateErr) return { error: 'Failed to update request. Please try again.' }

  // On approval: block the date in cleaner_availability (ignore if already blocked)
  if (decision === 'approved') {
    await admin
      .from('cleaner_availability')
      .upsert(
        {
          cleaner_id: req.cleaner_id,
          unavailable_date: req.requested_date,
          reason: 'Approved day-off request',
        },
        { onConflict: 'cleaner_id,unavailable_date', ignoreDuplicates: true }
      )
  }

  // Notify the cleaner
  const cleanerName = (req.profiles as unknown as { full_name: string } | null)?.full_name ?? 'Cleaner'
  const dateLabel   = formatDateShort(req.requested_date)

  await createNotification({
    userId: req.cleaner_id,
    title: decision === 'approved' ? 'Day-Off Approved' : 'Day-Off Rejected',
    body:
      decision === 'approved'
        ? `Your day-off on ${dateLabel} has been approved.`
        : `Your day-off request for ${dateLabel} was not approved.${admin_notes ? ` Note: ${admin_notes}` : ''}`,
    type: 'day_off_review',
  })

  revalidatePath('/admin/day-off-requests')
  revalidatePath(`/admin/cleaners/${req.cleaner_id}`)
  revalidatePath('/cleaner/day-off')

  return { success: `Request ${decision} successfully.` }
}

function formatDateShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
