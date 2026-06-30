'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { runAIDispatch, type RankedCleaner } from '@/lib/ai-assignment'

// ── Preview (dry-run): evaluate without writing assignments ──────────────────

export type PreviewState =
  | { ranked: RankedCleaner[]; reasoning: string[]; bookingLat: number | null; bookingLng: number | null }
  | { error: string }
  | undefined

export async function previewAIDispatch(
  _state: PreviewState,
  formData: FormData
): Promise<PreviewState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'super_admin') return { error: 'Unauthorized.' }

  const bookingId = formData.get('booking_id') as string
  if (!bookingId) return { error: 'Missing booking ID.' }

  try {
    const result = await runAIDispatch(bookingId, true) // dry run — no DB writes
    return { ranked: result.rankedCleaners, reasoning: result.reasoning, bookingLat: result.bookingLat, bookingLng: result.bookingLng }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'AI evaluation failed.' }
  }
}

// ── Confirm: commit the proposed cleaner IDs as 'assigned' assignments ───────

export type ConfirmState =
  | { dispatched: number }
  | { error: string }
  | undefined

export async function confirmAIDispatch(
  _state: ConfirmState,
  formData: FormData
): Promise<ConfirmState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'super_admin') return { error: 'Unauthorized.' }

  const bookingId    = formData.get('booking_id') as string
  const cleanerIds   = formData.getAll('cleaner_ids') as string[]

  if (!bookingId)            return { error: 'Missing booking ID.' }
  if (cleanerIds.length === 0) return { error: 'No cleaners to dispatch.' }

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('cleaner_assignments').upsert(
    cleanerIds.map((id) => ({
      booking_id: bookingId,
      cleaner_id: id,
      status: 'assigned' as const,
    })),
    { onConflict: 'booking_id,cleaner_id', ignoreDuplicates: true }
  )

  if (error) return { error: error.message }

  revalidatePath(`/admin/bookings/${bookingId}`)
  return { dispatched: cleanerIds.length }
}
