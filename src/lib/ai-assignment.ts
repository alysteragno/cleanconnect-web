/**
 * CleanConnect AI Assignment Engine — Rule-Based Decision Support System
 *
 * Implements the AI scheduling logic described in the capstone paper:
 *   1. Fetch all active cleaners
 *   2. Filter: remove cleaners with an approved day-off on service_date
 *   3. Filter: remove cleaners with a conflicting booking (± 2-hour buffer)
 *   4. Score remaining cleaners:
 *        workload   — number of assigned jobs on service_date (lower = better)
 *        proximity  — land/road distance from departure point to service address
 *                     (lower = better), via OpenRouteService (OSM-based) road
 *                     routing, falling back to a haversine straight-line
 *                     estimate if routing is unavailable (no key, request
 *                     failure, etc.). Departure point, in priority order:
 *                       1. last confirmed same-day job → that job's verified
 *                          arrival geotag (cleaner_assignments.arrived_lat/lng),
 *                          falling back to the customer's service_lat/lng pin
 *                       2. an opportunistic "last seen" ping (profiles.last_seen_lat/
 *                          lng), if fresh (within 6h) — used regardless of the
 *                          booking's own service_date, so this stays consistent
 *                          with the "All Cleaner Locations" map, which surfaces
 *                          the same ping unconditionally
 *                       3. the cleaner's admin-set home address (profiles.home_lat/lng)
 *                       4. business office (BUSINESS_LAT/LNG), if none of the above exist
 *        rating     — average customer feedback rating (higher = better)
 *        combined   — weighted: 50% workload + 30% proximity + 20% rating
 *                     degrades to 70% workload + 30% rating when booking has no coordinates
 *   5. Select top N candidates (required_cleaners + 2 buffer, max 5)
 *   6. Create cleaner_assignments with status = 'assigned' for each candidate
 *
 * This is rule-based AI — no trained model. Proximity calls OpenRouteService
 * (requires ORS_API_KEY) for a real road-network distance instead of a
 * straight line.
 * Proximity falls back to workload-only when booking geo data is absent.
 */

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { BUSINESS_LAT, BUSINESS_LNG } from '@/lib/constants'
import { getRoadRoute } from '@/lib/openrouteservice'
import { haversineKm } from '@/lib/geo'

export type RankedCleaner = {
  cleanerId: string
  fullName: string
  photoUrl: string | null
  workloadScore: number
  distanceKm: number | null
  departureLat: number | null
  departureLng: number | null
  departureSource: 'inter_job' | 'last_seen' | 'home' | 'business' | null
  avgRating: number | null
  finalScore: number
  rank: number
  dispatched: boolean
}

// A cleaner who was removed from consideration before scoring — surfaced
// (rather than silently dropped) so the dispatch UI can show them grayed out
// with a reason instead of just not mentioning them at all.
export type ExcludedCleaner = {
  cleanerId: string
  fullName: string
  photoUrl: string | null
  reason: 'day_off' | 'conflict'
  // Only set when reason is 'conflict' — the actual window ("8:00 AM – 11:00 AM")
  // of the other booking that overlaps, not just "busy this day."
  conflictWindow?: string
}

export type AIDispatchResult = {
  rankedCleaners: RankedCleaner[]
  excludedCleaners: ExcludedCleaner[]
  dispatched: number
  reasoning: string[]
  bookingLat: number | null
  bookingLng: number | null
}

// ── Main entry point ────────────────────────────────────────────────────────

export async function runAIDispatch(bookingId: string, dryRun = false): Promise<AIDispatchResult> {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const reasoning: string[] = []

  // ── Step 1: Load booking ────────────────────────────────────────────────
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, service_date, service_time, duration_hours, required_cleaners, status, service_lat, service_lng')
    .eq('id', bookingId)
    .single()

  if (!booking) throw new Error(bookingError?.message ?? 'Booking not found.')
  if (booking.status === 'completed' || booking.status === 'cancelled')
    throw new Error('Cannot dispatch a completed or cancelled booking.')

  const required = Number(booking.required_cleaners) || 1
  const newStart = timeToMinutes(booking.service_time)
  const newDuration = Number(booking.duration_hours) || 2

  reasoning.push(`Booking: ${booking.service_date} at ${booking.service_time}, ${newDuration}h, needs ${required} cleaner(s).`)

  const bookingLat = booking.service_lat != null ? Number(booking.service_lat) : null
  const bookingLng = booking.service_lng != null ? Number(booking.service_lng) : null

  // ── Step 2: All active cleaners ─────────────────────────────────────────
  // home_lat/lng and last_seen_lat/lng/at feed the departure-point fallback
  // chain in Step 4c below, for cleaners with no job yet today.
  const { data: allCleaners } = await adminClient
    .from('profiles')
    .select('id, full_name, photo_url, home_lat, home_lng, last_seen_lat, last_seen_lng, last_seen_at')
    .eq('role', 'cleaner')
    .eq('is_active', true)

  const allPool = allCleaners ?? []

  const { data: existingAssignments } = await adminClient
    .from('cleaner_assignments')
    .select('cleaner_id')
    .eq('booking_id', bookingId)
    .eq('status', 'assigned')

  const alreadyAssigned = new Set((existingAssignments ?? []).map((a: { cleaner_id: string }) => a.cleaner_id))
  const pool = allPool.filter((c) => !alreadyAssigned.has(c.id))

  reasoning.push(`Cleaner pool: ${allPool.length} active, ${alreadyAssigned.size} already assigned — ${pool.length} candidates.`)

  if (pool.length === 0) {
    return { rankedCleaners: [], excludedCleaners: [], dispatched: 0, bookingLat, bookingLng, reasoning: [...reasoning, 'All active cleaners are already assigned to this booking.'] }
  }

  // ── Step 3a: Filter — day-offs ──────────────────────────────────────────
  const { data: dayOffRows } = await adminClient
    .from('cleaner_day_off_requests')
    .select('cleaner_id')
    .eq('requested_date', booking.service_date)
    .eq('status', 'approved')
    .in('cleaner_id', pool.map((c) => c.id))

  const offSet = new Set((dayOffRows ?? []).map((d: { cleaner_id: string }) => d.cleaner_id))
  const afterDayOff = pool.filter((c) => !offSet.has(c.id))
  const dayOffExcluded: ExcludedCleaner[] = pool
    .filter((c) => offSet.has(c.id))
    .map((c) => ({ cleanerId: c.id, fullName: c.full_name, photoUrl: c.photo_url ?? null, reason: 'day_off' as const }))
  reasoning.push(`Day-off filter: removed ${offSet.size}, ${afterDayOff.length} remaining.`)

  if (afterDayOff.length === 0) {
    return { rankedCleaners: [], excludedCleaners: dayOffExcluded, dispatched: 0, bookingLat, bookingLng, reasoning: [...reasoning, 'All cleaners have day-offs on this date.'] }
  }

  // ── Step 3b: Shared same-day data (conflict + workload + proximity) ──────
  // Single query reused for conflict detection, workload scoring, and inter-job proximity.
  const { data: sameDayBookings } = await supabase
    .from('bookings')
    .select('id, service_time, duration_hours, service_lat, service_lng')
    .eq('service_date', booking.service_date)
    .neq('id', bookingId)

  const sameDayBookingIds = (sameDayBookings ?? []).map((b: { id: string }) => b.id)

  type BookingEntry = { service_time: string; duration_hours: number; lat: number | null; lng: number | null }
  const timeMap: Record<string, BookingEntry> = {}
  for (const b of sameDayBookings ?? []) {
    timeMap[b.id] = {
      service_time: b.service_time,
      duration_hours: b.duration_hours,
      lat: b.service_lat != null ? Number(b.service_lat) : null,
      lng: b.service_lng != null ? Number(b.service_lng) : null,
    }
  }

  // Fetch all same-day assignments for our candidate pool — one query covers
  // conflict detection, workload counting, and proximity routing.
  // arrived_lat/lng is the cleaner's own verified geotag from the "I've
  // Arrived" checkpoint in the mobile app — preferred below over the
  // customer's dropped pin (bookings.service_lat/lng) when present.
  let allSameDayAssignments: { cleaner_id: string; booking_id: string; arrived_lat: number | null; arrived_lng: number | null }[] = []
  if (sameDayBookingIds.length > 0) {
    const { data } = await supabase
      .from('cleaner_assignments')
      .select('cleaner_id, booking_id, arrived_lat, arrived_lng')
      .eq('status', 'assigned')
      .in('cleaner_id', afterDayOff.map((c) => c.id))
      .in('booking_id', sameDayBookingIds)
    allSameDayAssignments = data ?? []
  }

  // Conflict detection (± 2-hour buffer) — a cleaner with a job earlier or
  // later the same day that doesn't overlap this one (plus buffer) is NOT
  // excluded here and stays eligible below.
  const conflictWindows = new Map<string, string>()
  for (const a of allSameDayAssignments) {
    const bData = timeMap[a.booking_id]
    if (!bData) continue
    const existingStart = timeToMinutes(bData.service_time)
    const existingDuration = Number(bData.duration_hours) || 2
    if (hasTimeConflict(newStart, newDuration, existingStart, existingDuration)) {
      if (!conflictWindows.has(a.cleaner_id)) {
        conflictWindows.set(a.cleaner_id, formatBookingWindow(bData.service_time, existingDuration))
      }
    }
  }
  const conflictSet = new Set(conflictWindows.keys())

  const eligible = afterDayOff.filter((c) => !conflictSet.has(c.id))
  const conflictExcluded: ExcludedCleaner[] = afterDayOff
    .filter((c) => conflictSet.has(c.id))
    .map((c) => ({
      cleanerId: c.id, fullName: c.full_name, photoUrl: c.photo_url ?? null,
      reason: 'conflict' as const, conflictWindow: conflictWindows.get(c.id),
    }))
  const excludedCleaners: ExcludedCleaner[] = [...dayOffExcluded, ...conflictExcluded]
  reasoning.push(`Conflict filter (±2h buffer): removed ${conflictSet.size}, ${eligible.length} eligible.`)

  if (eligible.length === 0) {
    return { rankedCleaners: [], excludedCleaners, dispatched: 0, bookingLat, bookingLng, reasoning: [...reasoning, 'All available cleaners have scheduling conflicts on this day.'] }
  }

  // ── Step 4a: Fetch average performance ratings ──────────────────────────
  const { data: ratingRows } = await supabase
    .from('feedback')
    .select('cleaner_id, rating')
    .in('cleaner_id', eligible.map((c) => c.id))

  const ratingMap: Record<string, { sum: number; count: number }> = {}
  for (const r of ratingRows ?? []) {
    if (!ratingMap[r.cleaner_id]) ratingMap[r.cleaner_id] = { sum: 0, count: 0 }
    ratingMap[r.cleaner_id].sum += r.rating
    ratingMap[r.cleaner_id].count += 1
  }

  reasoning.push(`Performance ratings: ${Object.keys(ratingMap).length} of ${eligible.length} eligible cleaner(s) have rating data.`)

  // ── Step 4b: Workload (reuses allSameDayAssignments) ───────────────────
  const workloadMap: Record<string, number> = {}
  const eligibleIds = new Set(eligible.map((c) => c.id))
  for (const a of allSameDayAssignments) {
    if (eligibleIds.has(a.cleaner_id)) {
      workloadMap[a.cleaner_id] = (workloadMap[a.cleaner_id] ?? 0) + 1
    }
  }

  const maxWorkload = Math.max(1, ...eligible.map((c) => workloadMap[c.id] ?? 0))

  // ── Step 4c: Proximity — departure point fallback chain ─────────────────
  // 1. Last confirmed same-day job that ends before this one starts → its
  //    verified arrival geotag (or the customer's pin if unavailable)
  // 2. A fresh "last seen" ping (app-foreground, not continuous tracking —
  //    see profiles.last_seen_lat/lng/at), regardless of the booking's own
  //    service_date — it's still the best evidence available of where the
  //    cleaner actually is, and the "All Cleaner Locations" map surfaces the
  //    same ping unconditionally, so this keeps proximity figures consistent
  //    with what admins see plotted on the map.
  // 3. The cleaner's admin-set home address
  // 4. Business office coordinates (BUSINESS_LAT / BUSINESS_LNG)
  const hasBookingGeo = bookingLat != null && bookingLng != null
  const LAST_SEEN_STALENESS_MS = 6 * 60 * 60 * 1000

  const distanceMap: Record<string, number | null> = {}
  const departureMap: Record<string, { lat: number; lng: number; source: 'inter_job' | 'last_seen' | 'home' | 'business' }> = {}
  let interJobCount = 0
  let lastSeenCount = 0
  let homeCount = 0
  let businessFallbackCount = 0

  if (hasBookingGeo) {
    for (const c of eligible) {
      // Find prior jobs for this cleaner that end at or before the new booking starts
      const priorJobs = allSameDayAssignments
        .filter((a) => a.cleaner_id === c.id)
        .map((a) => {
          const entry = timeMap[a.booking_id]
          return entry ? { ...entry, assignment: a } : null
        })
        .filter((t): t is BookingEntry & { assignment: (typeof allSameDayAssignments)[number] } => t != null)
        .filter((t) => {
          const endMin = timeToMinutes(t.service_time) + (Number(t.duration_hours) || 2) * 60
          return endMin <= newStart
        })
        .sort((a, b) => timeToMinutes(b.service_time) - timeToMinutes(a.service_time))

      // Prefer the cleaner's own verified arrival geotag over the customer's
      // dropped pin when available — it's ground-truth GPS from the "I've
      // Arrived" checkpoint rather than a possibly-off address pin.
      const top = priorJobs[0]
      const interJobLat = top ? (top.assignment.arrived_lat != null ? Number(top.assignment.arrived_lat) : top.lat) : null
      const interJobLng = top ? (top.assignment.arrived_lng != null ? Number(top.assignment.arrived_lng) : top.lng) : null

      const lastSeenFresh =
        c.last_seen_lat != null && c.last_seen_lng != null && c.last_seen_at != null &&
        (Date.now() - new Date(c.last_seen_at).getTime()) <= LAST_SEEN_STALENESS_MS

      if (interJobLat != null && interJobLng != null) {
        departureMap[c.id] = { lat: interJobLat, lng: interJobLng, source: 'inter_job' }
        interJobCount++
      } else if (lastSeenFresh) {
        departureMap[c.id] = { lat: Number(c.last_seen_lat), lng: Number(c.last_seen_lng), source: 'last_seen' }
        lastSeenCount++
      } else if (c.home_lat != null && c.home_lng != null) {
        departureMap[c.id] = { lat: Number(c.home_lat), lng: Number(c.home_lng), source: 'home' }
        homeCount++
      } else {
        departureMap[c.id] = { lat: BUSINESS_LAT, lng: BUSINESS_LNG, source: 'business' }
        businessFallbackCount++
      }
    }

    // Road-route each *unique* departure point rather than per-cleaner — many
    // cleaners share the business-office fallback, so this both cuts
    // OpenRouteService calls and keeps the dispatch responsive (and the free
    // tier's daily quota further away). Falls back to a haversine
    // straight-line estimate per point if ORS is unreachable/unconfigured or
    // finds no drivable route.
    const uniqueDepartures = new Map<string, { lat: number; lng: number }>()
    for (const dep of Object.values(departureMap)) {
      uniqueDepartures.set(`${dep.lat},${dep.lng}`, dep)
    }

    const routeEntries = await Promise.all(
      Array.from(uniqueDepartures.entries()).map(async ([key, dep]) => {
        const route = await getRoadRoute(dep.lat, dep.lng, bookingLat, bookingLng)
        return [key, {
          distanceKm: route?.distanceKm ?? haversineKm(dep.lat, dep.lng, bookingLat, bookingLng),
          isRoadDistance: route != null,
        }] as const
      })
    )
    const routeMap = new Map(routeEntries)

    let roadRouteCount = 0
    for (const c of eligible) {
      const dep = departureMap[c.id]
      const route = routeMap.get(`${dep.lat},${dep.lng}`)!
      distanceMap[c.id] = route.distanceKm
      if (route.isRoadDistance) roadRouteCount++
    }

    reasoning.push(
      `Proximity: ${interJobCount} cleaner(s) routed from prior same-day job, ` +
      `${lastSeenCount} from a recent location ping, ${homeCount} from home address, ` +
      `${businessFallbackCount} from business office.`
    )
    reasoning.push(
      roadRouteCount === uniqueDepartures.size
        ? `Distance: road-network routing (OpenRouteService) for all ${uniqueDepartures.size} departure point(s).`
        : `Distance: road-network routing for ${roadRouteCount}/${uniqueDepartures.size} departure point(s); straight-line estimate used where routing was unavailable.`
    )
  } else {
    reasoning.push('Proximity: booking has no coordinates — skipping geo factor.')
  }

  // ── Step 4d: Score each eligible cleaner ────────────────────────────────
  const knownDistances = Object.values(distanceMap).filter((d): d is number => d != null)
  const maxDistance = knownDistances.length > 0 ? Math.max(...knownDistances) : 1

  const scored = eligible.map((c) => {
    const workload = workloadMap[c.id] ?? 0
    const workloadNorm = workload / maxWorkload

    const ratingData = ratingMap[c.id]
    const avgRating = ratingData ? ratingData.sum / ratingData.count : null
    const ratingNorm = avgRating != null ? (5 - avgRating) / 4 : 0.5

    const distanceKm = distanceMap[c.id] ?? null

    let finalScore: number
    if (hasBookingGeo) {
      const proximityNorm = distanceKm != null ? distanceKm / maxDistance : 0.5
      finalScore = 0.5 * workloadNorm + 0.3 * proximityNorm + 0.2 * ratingNorm
    } else {
      finalScore = 0.7 * workloadNorm + 0.3 * ratingNorm
    }

    return { ...c, workload, distanceKm, avgRating, finalScore }
  })

  const sorted = scored.sort((a, b) => a.finalScore - b.finalScore)

  reasoning.push(
    hasBookingGeo
      ? 'Ranking: 50% workload + 30% proximity + 20% performance rating.'
      : 'Ranking: 70% workload + 30% performance rating (no geo).'
  )

  // ── Step 5: Select top N candidates ─────────────────────────────────────
  const dispatchCount = Math.min(sorted.length, Math.min(required + 2, 5))
  const toDispatch = sorted.slice(0, dispatchCount)

  reasoning.push(`Dispatching top ${dispatchCount} (${required} required + buffer, max 5).`)

  // ── Step 6: Create 'assigned' assignments (skipped on dry-run preview) ──
  if (!dryRun && toDispatch.length > 0) {
    const { error: upsertError } = await supabase.from('cleaner_assignments').upsert(
      toDispatch.map((c) => ({
        booking_id: bookingId,
        cleaner_id: c.id,
        status: 'assigned' as const,
      })),
      { onConflict: 'booking_id,cleaner_id', ignoreDuplicates: true }
    )
    if (upsertError) throw new Error(`Failed to create assignments: ${upsertError.message}`)
  }

  const rankedCleaners: RankedCleaner[] = sorted.map((c, i) => {
    const dep = departureMap[c.id] ?? null
    return {
      cleanerId: c.id,
      fullName: c.full_name,
      photoUrl: c.photo_url ?? null,
      workloadScore: c.workload,
      distanceKm: c.distanceKm != null ? Math.round(c.distanceKm * 10) / 10 : null,
      departureLat: dep?.lat ?? null,
      departureLng: dep?.lng ?? null,
      departureSource: dep?.source ?? null,
      avgRating: c.avgRating != null ? Math.round(c.avgRating * 10) / 10 : null,
      finalScore: Math.round(c.finalScore * 100) / 100,
      rank: i + 1,
      dispatched: i < dispatchCount,
    }
  })

  reasoning.push(`Done. ${toDispatch.length} cleaner(s) assigned.`)

  return { rankedCleaners, excludedCleaners, dispatched: toDispatch.length, bookingLat, bookingLng, reasoning }
}

// ── Shared conflict guard (used by every assignment write path) ────────────
//
// runAIDispatch filters conflicting cleaners out of its own candidate pool
// before writing (Step 3b above), but dispatchCleaners, forceAssignCleaner,
// and confirmAIDispatch all write cleaner_assignments straight from
// client-submitted cleaner IDs with no server-side re-check — so a cleaner
// could otherwise be double-booked onto two overlapping jobs. Call this
// immediately before any cleaner_assignments insert/upsert.

/**
 * Returns the subset of candidateCleanerIds that already have an 'assigned'
 * cleaner_assignments row on another booking whose time window overlaps
 * bookingId's (± 2-hour buffer, same rule as the AI engine), with each
 * conflicting cleaner's name and the actual window they're busy for a
 * readable error message — a cleaner with a non-overlapping job earlier or
 * later the same day is NOT included here and remains assignable.
 */
export async function findConflictingCleaners(
  bookingId: string,
  candidateCleanerIds: string[]
): Promise<{ cleanerId: string; fullName: string; conflictWindow: string }[]> {
  if (candidateCleanerIds.length === 0) return []

  const adminClient = createAdminClient()

  const { data: booking } = await adminClient
    .from('bookings')
    .select('service_date, service_time, duration_hours')
    .eq('id', bookingId)
    .single()
  if (!booking) return []

  const newStart = timeToMinutes(booking.service_time)
  const newDuration = Number(booking.duration_hours) || 2

  const { data: sameDayBookings } = await adminClient
    .from('bookings')
    .select('id, service_time, duration_hours')
    .eq('service_date', booking.service_date)
    .neq('id', bookingId)

  const sameDayIds = (sameDayBookings ?? []).map((b: { id: string }) => b.id)
  if (sameDayIds.length === 0) return []

  const timeMap: Record<string, { service_time: string; duration_hours: number }> = {}
  for (const b of sameDayBookings ?? []) {
    timeMap[b.id] = { service_time: b.service_time, duration_hours: b.duration_hours }
  }

  const { data: existingAssignments } = await adminClient
    .from('cleaner_assignments')
    .select('cleaner_id, booking_id')
    .eq('status', 'assigned')
    .in('cleaner_id', candidateCleanerIds)
    .in('booking_id', sameDayIds)

  const conflictWindows = new Map<string, string>()
  for (const a of existingAssignments ?? []) {
    const bData = timeMap[a.booking_id]
    if (!bData) continue
    const existingStart = timeToMinutes(bData.service_time)
    const existingDuration = Number(bData.duration_hours) || 2
    if (hasTimeConflict(newStart, newDuration, existingStart, existingDuration)) {
      // Keep the first conflict found — a cleaner conflicting with two
      // separate bookings the same day is rare enough that showing one
      // window is a fine tradeoff against fetching/joining every conflict.
      if (!conflictWindows.has(a.cleaner_id)) {
        conflictWindows.set(a.cleaner_id, formatBookingWindow(bData.service_time, existingDuration))
      }
    }
  }

  if (conflictWindows.size === 0) return []

  const { data: names } = await adminClient
    .from('profiles')
    .select('id, full_name')
    .in('id', Array.from(conflictWindows.keys()))

  return (names ?? []).map((n: { id: string; full_name: string }) => ({
    cleanerId: n.id,
    fullName: n.full_name,
    conflictWindow: conflictWindows.get(n.id)!,
  }))
}

// ── Utilities ────────────────────────────────────────────────────────────────

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + (m || 0)
}

function hasTimeConflict(
  newStart: number,
  newDuration: number,
  existingStart: number,
  existingDuration: number
): boolean {
  const BUFFER = 120
  const newWindowStart = newStart - BUFFER
  const newWindowEnd = newStart + newDuration * 60 + BUFFER
  const existingWindowStart = existingStart - BUFFER
  const existingWindowEnd = existingStart + existingDuration * 60 + BUFFER
  return newWindowStart < existingWindowEnd && newWindowEnd > existingWindowStart
}

function formatClockMinutes(totalMin: number): string {
  const h24 = ((Math.floor(totalMin / 60) % 24) + 24) % 24
  const m = ((totalMin % 60) + 60) % 60
  const period = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

/** "08:00" + 3 → "8:00 AM – 11:00 AM" — the actual job window a conflict is
 *  against, so admins/dispatch UIs can show *why* a cleaner is unavailable
 *  instead of just flagging the whole day as busy. */
export function formatBookingWindow(serviceTime: string, durationHours: number): string {
  const startMin = timeToMinutes(serviceTime)
  const endMin = startMin + durationHours * 60
  return `${formatClockMinutes(startMin)} – ${formatClockMinutes(endMin)}`
}
