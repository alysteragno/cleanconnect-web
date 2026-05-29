'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export type CleanerActionState = { error: string } | undefined

async function getVerifiedAssignment(supabase: Awaited<ReturnType<typeof createClient>>, assignmentId: string, userId: string) {
  const { data } = await supabase
    .from('cleaner_assignments')
    .select('id, booking_id, status, cleaner_id')
    .eq('id', assignmentId)
    .eq('cleaner_id', userId)
    .single()
  return data
}

export async function acceptOffer(
  state: CleanerActionState,
  formData: FormData
): Promise<CleanerActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const assignmentId = formData.get('assignment_id') as string
  const assignment = await getVerifiedAssignment(supabase, assignmentId, user.id)
  if (!assignment) return { error: 'Assignment not found.' }
  if (assignment.status !== 'offered') return { error: 'This offer is no longer available.' }

  // Step 1: Accept the assignment
  const { error: e1 } = await supabase
    .from('cleaner_assignments')
    .update({ status: 'accepted' })
    .eq('id', assignmentId)
  if (e1) return { error: e1.message }

  // Step 2: Confirm the booking (RLS now allows because assignment is 'accepted')
  const { error: e2 } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', assignment.booking_id)
  if (e2) return { error: e2.message }

  revalidatePath('/cleaner')
  redirect(`/cleaner/jobs/${assignmentId}`)
}

export async function declineOffer(
  state: CleanerActionState,
  formData: FormData
): Promise<CleanerActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const assignmentId = formData.get('assignment_id') as string
  const assignment = await getVerifiedAssignment(supabase, assignmentId, user.id)
  if (!assignment) return { error: 'Assignment not found.' }
  if (assignment.status !== 'offered') return { error: 'This offer has already been responded to.' }

  const { error } = await supabase
    .from('cleaner_assignments')
    .update({ status: 'declined' })
    .eq('id', assignmentId)
  if (error) return { error: error.message }

  revalidatePath('/cleaner')
  redirect('/cleaner')
}

export async function startJob(
  state: CleanerActionState,
  formData: FormData
): Promise<CleanerActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const assignmentId = formData.get('assignment_id') as string
  const assignment = await getVerifiedAssignment(supabase, assignmentId, user.id)
  if (!assignment) return { error: 'Assignment not found.' }
  if (assignment.status !== 'accepted') return { error: 'Job must be accepted before starting.' }

  const now = new Date().toISOString()

  const { error: e1 } = await supabase
    .from('cleaner_assignments')
    .update({ started_at: now })
    .eq('id', assignmentId)
  if (e1) return { error: e1.message }

  const { error: e2 } = await supabase
    .from('bookings')
    .update({ status: 'in_progress' })
    .eq('id', assignment.booking_id)
  if (e2) return { error: e2.message }

  revalidatePath(`/cleaner/jobs/${assignmentId}`)
  redirect(`/cleaner/jobs/${assignmentId}`)
}

export async function completeJob(
  state: CleanerActionState,
  formData: FormData
): Promise<CleanerActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const assignmentId = formData.get('assignment_id') as string
  const assignment = await getVerifiedAssignment(supabase, assignmentId, user.id)
  if (!assignment) return { error: 'Assignment not found.' }
  if (assignment.status !== 'accepted') return { error: 'Invalid assignment state.' }

  const { error: e1 } = await supabase
    .from('cleaner_assignments')
    .update({ status: 'completed' })
    .eq('id', assignmentId)
  if (e1) return { error: e1.message }

  const { error: e2 } = await supabase
    .from('bookings')
    .update({ status: 'completed' })
    .eq('id', assignment.booking_id)
  if (e2) return { error: e2.message }

  revalidatePath('/cleaner')
  revalidatePath(`/cleaner/jobs/${assignmentId}`)
  redirect('/cleaner')
}
