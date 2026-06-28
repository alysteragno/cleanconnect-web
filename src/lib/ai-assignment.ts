/**
 * CleanConnect AI Assignment Engine — Rule-Based Decision Support System
 *
 * Implements the AI scheduling logic described in the capstone paper:
 *   1. Fetch all active cleaners in the booking's branch
 *   2. Filter: remove cleaners with an approved day-off on service_date
 *   3. Filter: remove cleaners with a conflicting booking (± 2-hour buffer)
 *   4. Score remaining cleaners:
 *        workload  — number of assigned jobs on service_date (lower = better)
 *        proximity — haversine distance from cleaner home to service address (lower = better)
 *        rating    — average customer feedback rating (higher = better)
 *        combined  — weighted: 50% workload + 30% proximity + 20% rating
 *                    falls back to 70% workload + 30% rating when geo data is absent
 *   5. Select top N candidates (required_cleaners + 2 buffer, max 5)
 *   6. Create cleaner_assignments with status = 'assigned' for each candidate
 *
 * This is rule-based AI — no trained model, no external API.
 * Geo ranking falls back to workload-only when lat/lng is absent.
 */

import { createClient, createAdminClient } from '@/utils/supabase/server'

export type RankedCleaner = {
  cleanerId: string
  fullName: string
  workloadScore: number
  distanceKm: number | null
  avgRating: number | null
  finalScore: number
  rank: number
  dispatched: boolean
}

export type AIDispatchResult = {
  rankedCleaners: RankedCleaner[]
  dispatched: number
  reasoning: string[]
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

  // ── Step 2: All active cleaners ─────────────────────────────────────────
  // Single-branch operation — branch_id on profiles is nullable and may not be
  // set on all cleaners, so we fetch all active cleaners without branch filtering.
  // Admin client is required to bypass RLS on profiles.
  const { data: allCleaners } = await adminClient
    .from('profiles')
    .select('id, full_name, home_lat, home_lng')
    .eq('role', 'cleaner')
    .eq('is_active', true)

  const allPool = allCleaners ?? []

  // Exclude cleaners already assigned to this booking
  const { data: existingAssignments } = await adminClient
    .from('cleaner_assignments')
    .select('cleaner_id')
    .eq('booking_id', bookingId)
    .eq('status', 'assigned')

  const alreadyAssigned = new Set((existingAssignments ?? []).map((a: { cleaner_id: string }) => a.cleaner_id))
  const pool = allPool.filter((c) => !alreadyAssigned.has(c.id))

  reasoning.push(`Cleaner pool: ${allPool.length} active, ${alreadyAssigned.size} already assigned — ${pool.length} candidates.`)

  if (pool.length === 0) {
    return { rankedCleaners: [], dispatched: 0, reasoning: [...reasoning, 'All active cleaners are already assigned to this booking.'] }
  }

  // ── Step 3a: Filter — day-offs ──────────────────────────────────────────
  const { data: dayOffRows } = await supabase
    .from('cleaner_availability')
    .select('cleaner_id')
    .eq('unavailable_date', booking.service_date)
    .in('cleaner_id', pool.map((c) => c.id))

  const offSet = new Set((dayOffRows ?? []).map((d: { cleaner_id: string }) => d.cleaner_id))
  const afterDayOff = pool.filter((c) => !offSet.has(c.id))
  reasoning.push(`Day-off filter: removed ${offSet.size}, ${afterDayOff.length} remaining.`)

  if (afterDayOff.length === 0) {
    return { rankedCleaners: [], dispatched: 0, reasoning: [...reasoning, 'All cleaners have day-offs on this date.'] }
  }

  // ── Step 3b: Filter — time conflicts with 2-hour buffer ─────────────────
  // Fetch all bookings on service_date in one query
  const { data: sameDayBookings } = await supabase
    .from('bookings')
    .select('id, service_time, duration_hours')
    .eq('service_date', booking.service_date)
    .neq('id', bookingId) // exclude the current booking itself

  const sameDayBookingIds = (sameDayBookings ?? []).map((b: { id: string }) => b.id)

  // Build time lookup map
  const timeMap: Record<string, { service_time: string; duration_hours: number }> = {}
  for (const b of sameDayBookings ?? []) {
    timeMap[b.id] = { service_time: b.service_time, duration_hours: b.duration_hours }
  }

  // Fetch accepted assignments for our candidates on that day
  const conflictSet = new Set<string>()

  if (sameDayBookingIds.length > 0) {
    const { data: sameDayAssignments } = await supabase
      .from('cleaner_assignments')
      .select('cleaner_id, booking_id')
      .eq('status', 'assigned')
      .in('cleaner_id', afterDayOff.map((c) => c.id))
      .in('booking_id', sameDayBookingIds)

    for (const a of sameDayAssignments ?? []) {
      const bData = timeMap[a.booking_id]
      if (!bData) continue
      const existingStart = timeToMinutes(bData.service_time)
      const existingDuration = Number(bData.duration_hours) || 2
      if (hasTimeConflict(newStart, newDuration, existingStart, existingDuration)) {
        conflictSet.add(a.cleaner_id)
      }
    }
  }

  const eligible = afterDayOff.filter((c) => !conflictSet.has(c.id))
  reasoning.push(`Conflict filter (±2h buffer): removed ${conflictSet.size}, ${eligible.length} eligible.`)

  if (eligible.length === 0) {
    return { rankedCleaners: [], dispatched: 0, reasoning: [...reasoning, 'All available cleaners have scheduling conflicts on this day.'] }
  }

  // ── Step 4a: Fetch average performance ratings for eligible cleaners ────
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

  const ratedCount = Object.keys(ratingMap).length
  reasoning.push(`Performance ratings: ${ratedCount} of ${eligible.length} eligible cleaner(s) have rating data.`)

  // ── Step 4b: Score each eligible cleaner ────────────────────────────────
  // Workload: count of assigned jobs on service_date
  const workloadMap: Record<string, number> = {}

  if (sameDayBookingIds.length > 0) {
    const { data: workloadRows } = await supabase
      .from('cleaner_assignments')
      .select('cleaner_id')
      .eq('status', 'assigned')
      .in('cleaner_id', eligible.map((c) => c.id))
      .in('booking_id', sameDayBookingIds)

    for (const w of workloadRows ?? []) {
      workloadMap[w.cleaner_id] = (workloadMap[w.cleaner_id] ?? 0) + 1
    }
  }

  const maxWorkload = Math.max(1, ...eligible.map((c) => workloadMap[c.id] ?? 0))

  // ── Step 4c: Compute haversine distances ────────────────────────────────
  const bookingLat = booking.service_lat != null ? Number(booking.service_lat) : null
  const bookingLng = booking.service_lng != null ? Number(booking.service_lng) : null
  const hasBookingGeo = bookingLat != null && bookingLng != null

  const distanceMap: Record<string, number | null> = {}
  if (hasBookingGeo) {
    for (const c of eligible) {
      distanceMap[c.id] =
        c.home_lat != null && c.home_lng != null
          ? haversineKm(Number(c.home_lat), Number(c.home_lng), bookingLat!, bookingLng!)
          : null
    }
  }

  const knownDistances = Object.values(distanceMap).filter((d): d is number => d != null)
  const maxDistance = knownDistances.length > 0 ? Math.max(...knownDistances) : 1

  if (hasBookingGeo) {
    const geoCount = knownDistances.length
    reasoning.push(`Proximity: geo data available for ${geoCount} of ${eligible.length} cleaner(s).`)
  } else {
    reasoning.push('Proximity: booking has no coordinates — skipping geo factor.')
  }

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
      // 50% workload + 30% proximity + 20% performance rating
      finalScore = 0.5 * workloadNorm + 0.3 * proximityNorm + 0.2 * ratingNorm
    } else {
      // fallback: 70% workload + 30% performance rating
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

  reasoning.push(`Dispatching to top ${dispatchCount} (${required} required + buffer, max 5).`)

  // ── Step 6: Create 'assigned' assignments (skipped on dry-run preview) ─────
  if (!dryRun && toDispatch.length > 0) {
    await supabase.from('cleaner_assignments').upsert(
      toDispatch.map((c) => ({
        booking_id: bookingId,
        cleaner_id: c.id,
        status: 'assigned' as const,
      })),
      { onConflict: 'booking_id,cleaner_id', ignoreDuplicates: true }
    )
  }

  const rankedCleaners: RankedCleaner[] = sorted.map((c, i) => ({
    cleanerId: c.id,
    fullName: c.full_name,
    workloadScore: c.workload,
    distanceKm: c.distanceKm,
    avgRating: c.avgRating != null ? Math.round(c.avgRating * 10) / 10 : null,
    finalScore: Math.round(c.finalScore * 100) / 100,
    rank: i + 1,
    dispatched: i < dispatchCount,
  }))

  reasoning.push(`Done. ${toDispatch.length} cleaner(s) assigned.`)

  return { rankedCleaners, dispatched: toDispatch.length, reasoning }
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
  const BUFFER = 120 // 2 hours in minutes
  const newWindowStart = newStart - BUFFER
  const newWindowEnd = newStart + newDuration * 60 + BUFFER
  const existingWindowStart = existingStart - BUFFER
  const existingWindowEnd = existingStart + existingDuration * 60 + BUFFER
  return newWindowStart < existingWindowEnd && newWindowEnd > existingWindowStart
}

