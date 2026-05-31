'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { runAIDispatch } from '@/lib/ai-assignment'

export type AIDispatchState =
  | { dispatched: number; reasoning: string[] }
  | { error: string }
  | undefined

export async function aiDispatchCleaners(
  state: AIDispatchState,
  formData: FormData
): Promise<AIDispatchState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    return { error: 'Unauthorized.' }
  }

  const bookingId = formData.get('booking_id') as string
  if (!bookingId) return { error: 'Missing booking ID.' }

  try {
    const result = await runAIDispatch(bookingId)
    revalidatePath(`/admin/bookings/${bookingId}`)
    return { dispatched: result.dispatched, reasoning: result.reasoning }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'AI dispatch failed.' }
  }
}
