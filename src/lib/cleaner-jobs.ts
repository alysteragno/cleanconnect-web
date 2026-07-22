import type { createAdminClient } from '@/utils/supabase/server'

/**
 * Counts each cleaner's upcoming (today or later, Manila time) assigned
 * jobs. Supabase can't filter on a nested join's column in one query, so
 * this fetches 'assigned' cleaner_assignments first, then the bookings they
 * point at, and counts the ones still in the future — same two-step
 * pattern as getCleanerWeekScheduleData (src/app/actions/admin.ts) and the
 * AI dispatch conflict check (src/lib/ai-assignment.ts).
 *
 * Shared by the resignation-requests list, the cleaner detail page, and
 * toggleCleanerStatus's server-side deactivation guard — all three need the
 * same "does this cleaner have jobs still to cover" answer.
 */
export async function getUpcomingAssignedJobCounts(
  adminClient: ReturnType<typeof createAdminClient>,
  cleanerIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (cleanerIds.length === 0) return counts

  const todayManila = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

  const { data: assignments } = await adminClient
    .from('cleaner_assignments')
    .select('cleaner_id, booking_id')
    .in('cleaner_id', cleanerIds)
    .eq('status', 'assigned')

  const bookingIds = [...new Set((assignments ?? []).map((a) => a.booking_id))]
  if (bookingIds.length === 0) return counts

  const { data: bookings } = await adminClient
    .from('bookings')
    .select('id')
    .in('id', bookingIds)
    .gte('service_date', todayManila)

  const upcomingBookingIds = new Set((bookings ?? []).map((b) => b.id))

  for (const a of assignments ?? []) {
    if (upcomingBookingIds.has(a.booking_id)) {
      counts.set(a.cleaner_id, (counts.get(a.cleaner_id) ?? 0) + 1)
    }
  }
  return counts
}

/** Single-cleaner convenience wrapper around getUpcomingAssignedJobCounts. */
export async function getUpcomingAssignedJobCount(
  adminClient: ReturnType<typeof createAdminClient>,
  cleanerId: string
): Promise<number> {
  const counts = await getUpcomingAssignedJobCounts(adminClient, [cleanerId])
  return counts.get(cleanerId) ?? 0
}
