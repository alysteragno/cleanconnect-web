/**
 * CleanConnect AI Assignment Engine — Rule-Based Decision Support System
 *
 * Implements the AI scheduling logic described in the capstone paper:
 *   1. Fetch all active cleaners
 *   2. Filter: remove cleaners with an approved day-off on service_date
 *   3. Filter: remove cleaners with a conflicting booking (± 2-hour buffer)
 *   4. Score remaining cleaners:
 *        workload   — number of assigned jobs on service_date (lower = better)
 *        proximity  — haversine distance from departure point to service address (lower = better)
 *                     departure = last confirmed same-day job location → service location
 *                     fallback  = business office → service location (when no prior same-day job)
 *        rating     — average customer feedback rating (higher = better)
 *        combined   — weighted: 50% workload + 30% proximity + 20% rating
 *                     degrades to 70% workload + 30% rating when booking has no coordinates
 *   5. Select top N candidates (required_cleaners + 2 buffer, max 5)
 *   6. Create cleaner_assignments with status = 'assigned' for each candidate
 *
 * This is rule-based AI — no trained model, no external API.
 * Proximity falls back to workload-only when booking geo data is absent.
 */

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { BUSINESS_LAT, BUSINESS_LNG } from '@/lib/constants'

export type RankedCleaner = {
  cleanerId: string
  fullName: string
  photoUrl: string | null
  workloadScore: number
  distanceKm: number | null
  departureLat: number | null
  departureLng: number | null
  departureSource: 'inter_job' | 'business' | null
  avgRating: number | null
  finalScore: number
  rank: number
  dispatched: boolean
}

export type AIDispatchResult = {
  rankedCleaners: RankedCleaner[]
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
  const { data: allCleaners } = await adminClient
    .from('profiles')
    .select('id, full_name, photo_url')
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
    return { rankedCleaners: [], dispatched: 0, bookingLat, bookingLng, reasoning: [...reasoning, 'All active cleaners are already assigned to this booking.'] }
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
  reasoning.push(`Day-off filter: removed ${offSet.size}, ${afterDayOff.length} remaining.`)

  if (afterDayOff.length === 0) {
    return { rankedCleaners: [], dispatched: 0, bookingLat, bookingLng, reasoning: [...reasoning, 'All cleaners have day-offs on this date.'] }
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
  let allSameDayAssignments: { cleaner_id: string; booking_id: string }[] = []
  if (sameDayBookingIds.length > 0) {
    const { data } = await supabase
      .from('cleaner_assignments')
      .select('cleaner_id, booking_id')
      .eq('status', 'assigned')
      .in('cleaner_id', afterDayOff.map((c) => c.id))
      .in('booking_id', sameDayBookingIds)
    allSameDayAssignments = data ?? []
  }

  // Conflict detection (± 2-hour buffer)
  const conflictSet = new Set<string>()
  for (const a of allSameDayAssignments) {
    const bData = timeMap[a.booking_id]
    if (!bData) continue
    const existingStart = timeToMinutes(bData.service_time)
    const existingDuration = Number(bData.duration_hours) || 2
    if (hasTimeConflict(newStart, newDuration, existingStart, existingDuration)) {
      conflictSet.add(a.cleaner_id)
    }
  }

  const eligible = afterDayOff.filter((c) => !conflictSet.has(c.id))
  reasoning.push(`Conflict filter (±2h buffer): removed ${conflictSet.size}, ${eligible.length} eligible.`)

  if (eligible.length === 0) {
    return { rankedCleaners: [], dispatched: 0, bookingLat, bookingLng, reasoning: [...reasoning, 'All available cleaners have scheduling conflicts on this day.'] }
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

  // ── Step 4c: Inter-job proximity ────────────────────────────────────────
  // Departure point for each cleaner:
  //   1. Last confirmed same-day assignment that ends before this booking starts
  //      → use that job's service_lat/service_lng
  //   2. Fallback: business office coordinates (BUSINESS_LAT / BUSINESS_LNG)
  const hasBookingGeo = bookingLat != null && bookingLng != null

  const distanceMap: Record<string, number | null> = {}
  const departureMap: Record<string, { lat: number; lng: number; source: 'inter_job' | 'business' }> = {}
  let interJobCount = 0
  let businessFallbackCount = 0

  if (hasBookingGeo) {
    for (const c of eligible) {
      // Find prior jobs for this cleaner that end at or before the new booking starts
      const priorJobs = allSameDayAssignments
        .filter((a) => a.cleaner_id === c.id)
        .map((a) => timeMap[a.booking_id])
        .filter((t): t is BookingEntry => t != null)
        .filter((t) => {
          const endMin = timeToMinutes(t.service_time) + (Number(t.duration_hours) || 2) * 60
          return endMin <= newStart
        })
        .sort((a, b) => timeToMinutes(b.service_time) - timeToMinutes(a.service_time))

      if (priorJobs.length > 0 && priorJobs[0].lat != null && priorJobs[0].lng != null) {
        const { lat, lng } = priorJobs[0]
        distanceMap[c.id] = haversineKm(lat, lng, bookingLat, bookingLng)
        departureMap[c.id] = { lat, lng, source: 'inter_job' }
        interJobCount++
      } else {
        distanceMap[c.id] = haversineKm(BUSINESS_LAT, BUSINESS_LNG, bookingLat, bookingLng)
        departureMap[c.id] = { lat: BUSINESS_LAT, lng: BUSINESS_LNG, source: 'business' }
        businessFallbackCount++
      }
    }

    reasoning.push(
      `Proximity: ${interJobCount} cleaner(s) routed from prior same-day job; ${businessFallbackCount} from business office.`
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

  return { rankedCleaners, dispatched: toDispatch.length, bookingLat, bookingLng, reasoning }
}

// ── Utilities ────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

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
