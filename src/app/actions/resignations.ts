'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { createNotification } from './notifications'

export type ResignationState = { error?: string; success?: string } | undefined

// ── Admin: acknowledge a cleaner's resignation request ──────────────────────
//
// Acknowledging is the only decision the web admin UI offers — resignation
// is finalized in person at the business office, so there's nothing to
// "reject" here on the web side. The note is required because it's how the
// admin tells the cleaner what happens next (e.g. "Come to the office on
// [date] to complete your final pay processing").
//
// This does NOT touch the cleaner's profile — acknowledging the request and
// deactivating the account are two separate events that can happen days
// apart (the cleaner still has to show up in person). Deactivation happens
// later, manually, from the cleaner's own profile page (Account Status
// toggle), which already blocks if they still have upcoming assigned jobs.
// The request row only moves 'pending' → 'in_progress' here; see
// supabase/migration_resignation_status_in_progress.sql.
export async function reviewResignationRequest(
  state: ResignationState,
  formData: FormData
): Promise<ResignationState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!adminProfile || adminProfile.role !== 'super_admin') return { error: 'Unauthorized.' }

  const request_id = (formData.get('request_id') as string ?? '').trim()
  const admin_note  = (formData.get('admin_note') as string | null)?.trim() || ''

  if (!request_id) return { error: 'Invalid request.' }
  if (!admin_note) return { error: 'A note to the cleaner is required — let them know what happens next (e.g. when to come to the office).' }

  const admin = createAdminClient()

  const { data: req } = await admin
    .from('cleaner_resignation_requests')
    .select('id, cleaner_id, status, profiles!cleaner_id (full_name)')
    .eq('id', request_id)
    .single()

  if (!req) return { error: 'Request not found.' }
  if (req.status !== 'pending') return { error: 'This request has already been reviewed.' }

  const nowIso = new Date().toISOString()

  const { error: updateErr } = await admin
    .from('cleaner_resignation_requests')
    .update({
      status: 'in_progress',
      admin_note,
      reviewed_by: user.id,
      reviewed_at: nowIso,
    })
    .eq('id', request_id)

  if (updateErr) return { error: updateErr.message }

  const cleanerProfile = Array.isArray(req.profiles) ? req.profiles[0] : req.profiles
  const cleanerName = (cleanerProfile as { full_name: string } | null)?.full_name ?? 'Cleaner'

  await createNotification({
    userId: req.cleaner_id,
    title: 'Resignation Request Acknowledged',
    body: `Your resignation request has been acknowledged. ${admin_note}`,
    type: 'resignation_review',
  })

  revalidatePath('/admin/resignation-requests')

  return { success: `Request acknowledged. ${cleanerName} has been notified.` }
}
