'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { runAIDispatch, findConflictingCleaners, type RankedCleaner, type ExcludedCleaner } from '@/lib/ai-assignment'
import type { CleanerLocation } from '../(dashboard)/admin/bookings/[id]/all-cleaners-map'

// ── Preview (dry-run): evaluate without writing assignments ──────────────────

export type PreviewState =
  | { ranked: RankedCleaner[]; excluded: ExcludedCleaner[]; reasoning: string[]; bookingLat: number | null; bookingLng: number | null; cleanerLocations: CleanerLocation[] }
  | { error: string }
  | undefined

// Every active cleaner's last known location — same last_seen → home fallback
// as the /admin/cleaners map, fetched independently of the ranking pass above
// (which uses a different, booking-specific departure-point chain that also
// considers same-day prior jobs and the business office).
async function getAllCleanerLocations(): Promise<CleanerLocation[]> {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('profiles')
    .select('id, full_name, photo_url, home_lat, home_lng, last_seen_lat, last_seen_lng, last_seen_at')
    .eq('role', 'cleaner')
    .eq('is_active', true)

  return (data ?? []).reduce<CleanerLocation[]>((acc, c) => {
    if (c.last_seen_lat != null && c.last_seen_lng != null) {
      acc.push({ id: c.id, full_name: c.full_name, photo_url: c.photo_url, lat: c.last_seen_lat, lng: c.last_seen_lng, source: 'last_seen', lastSeenAt: c.last_seen_at })
    } else if (c.home_lat != null && c.home_lng != null) {
      acc.push({ id: c.id, full_name: c.full_name, photo_url: c.photo_url, lat: c.home_lat, lng: c.home_lng, source: 'home', lastSeenAt: null })
    }
    return acc
  }, [])
}

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
    const [result, cleanerLocations] = await Promise.all([
      runAIDispatch(bookingId, true), // dry run — no DB writes
      getAllCleanerLocations(),
    ])
    return { ranked: result.rankedCleaners, excluded: result.excludedCleaners, reasoning: result.reasoning, bookingLat: result.bookingLat, bookingLng: result.bookingLng, cleanerLocations }
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

  // The AI preview's conflict filter ran before this confirm step, on a
  // possibly stale snapshot — re-check now, right before the write, to
  // close that race instead of trusting the client-submitted ID list.
  const conflicts = await findConflictingCleaners(bookingId, cleanerIds)
  if (conflicts.length > 0) {
    return { error: `${conflicts.map((c) => `${c.fullName} (${c.conflictWindow})`).join(', ')} already ${conflicts.length === 1 ? 'has' : 'have'} an overlapping booking — refresh and try again.` }
  }

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
