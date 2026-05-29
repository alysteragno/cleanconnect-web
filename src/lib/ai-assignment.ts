/**
 * CleanConnect AI Assignment Engine — Rule-Based Decision Support System
 *
 * Implements the AI scheduling logic described in the capstone paper:
 *   1. Fetch all active cleaners in the booking's branch
 *   2. Filter: remove cleaners with an approved day-off on service_date
 *   3. Filter: remove cleaners with a conflicting booking (± 2-hour buffer)
 *   4. Score remaining cleaners:
 *        workload  — number of accepted jobs on service_date (lower = better)
 *        proximity — haversine distance from cleaner home to service address (lower = better)
 *        combined  — weighted: 60% workload + 40% proximity
 *   5. Select top N candidates (required_cleaners + 2 buffer, max 5)
 *   6. Create cleaner_assignments with status = 'offered' for each candidate
 *
 * This is rule-based AI — no trained model, no external API.
 * Geo ranking falls back to workload-only when lat/lng is absent.
 */

import { createClient } from '@/utils/supabase/server'

export type RankedCleaner = {
  cleanerId: string
  fullName: string
  workloadScore: number
  distanceKm: number | null
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

export async function runAIDispatch(bookingId: string): Promise<AIDispatchResult> {
  const supabase = await createClient()
  const reasoning: string[] = []

  // ── Step 1: Load booking ────────────────────────────────────────────────
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, branch_id, service_date, service_time, duration_hours, required_cleaners, service_lat, service_lng, status')
    .eq('id', bookingId)
    .single()

  if (!booking) throw new Error('Booking not found.')
  if (booking.status === 'completed' || booking.status === 'cancelled')
    throw new Error('Cannot dispatch a completed or cancelled booking.')

  const required = Number(booking.required_cleaners) || 1
  const newStart = timeToMinutes(booking.service_time)
  const newDuration = Number(booking.duration_hours) || 2
  const hasServiceGeo = booking.service_lat != null && booking.service_lng != null

  reasoning.push(`Booking: ${booking.service_date} at ${booking.service_time}, ${newDuration}h, needs ${required} cleaner(s).`)

  // ── Step 2: All active cleaners in this branch ──────────────────────────
  const { data: allCleaners } = await supabase
    .from('profiles')
    .select('id, full_name, home_lat, home_lng')
    .eq('branch_id', booking.branch_id)
    .eq('role', 'cleaner')
    .eq('is_active', true)

  const pool = allCleaners ?? []
  reasoning.push(`Branch pool: ${pool.length} active cleaner(s).`)

  if (pool.length === 0) {
    return { rankedCleaners: [], dispatched: 0, reasoning: [...reasoning, 'No cleaners available in this branch.'] }
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
      .eq('status', 'accepted')
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

  // ── Step 4: Score each eligible cleaner ─────────────────────────────────
  // Workload: count of accepted jobs on service_date
  const workloadMap: Record<string, number> = {}

  if (sameDayBookingIds.length > 0) {
    const { data: workloadRows } = await supabase
      .from('cleaner_assignments')
      .select('cleaner_id')
      .eq('status', 'accepted')
      .in('cleaner_id', eligible.map((c) => c.id))
      .in('booking_id', sameDayBookingIds)

    for (const w of workloadRows ?? []) {
      workloadMap[w.cleaner_id] = (workloadMap[w.cleaner_id] ?? 0) + 1
    }
  }

  const maxWorkload = Math.max(1, ...eligible.map((c) => workloadMap[c.id] ?? 0))

  const scored = eligible.map((c) => {
    const workload = workloadMap[c.id] ?? 0
    const workloadNorm = workload / maxWorkload

    let distanceKm: number | null = null
    let distanceNorm = 0.5 // neutral fallback

    if (hasServiceGeo && c.home_lat != null && c.home_lng != null) {
      distanceKm = haversine(
        Number(c.home_lat), Number(c.home_lng),
        Number(booking.service_lat), Number(booking.service_lng)
      )
      distanceNorm = Math.min(distanceKm / 50, 1) // 50 km reference cap
    }

    // Lower score = better candidate
    const finalScore = hasServiceGeo
      ? 0.6 * workloadNorm + 0.4 * distanceNorm
      : workloadNorm

    return { ...c, workload, distanceKm, finalScore }
  })

  const sorted = scored.sort((a, b) => a.finalScore - b.finalScore)

  reasoning.push(
    hasServiceGeo
      ? 'Ranking: 60% workload + 40% proximity (haversine).'
      : 'No geo coordinates on booking — ranking by workload only.'
  )

  // ── Step 5: Select top N candidates ─────────────────────────────────────
  const dispatchCount = Math.min(sorted.length, Math.min(required + 2, 5))
  const toDispatch = sorted.slice(0, dispatchCount)

  reasoning.push(`Dispatching to top ${dispatchCount} (${required} required + buffer, max 5).`)

  // ── Step 6: Create 'offered' assignments ────────────────────────────────
  if (toDispatch.length > 0) {
    await supabase.from('cleaner_assignments').upsert(
      toDispatch.map((c) => ({
        booking_id: bookingId,
        cleaner_id: c.id,
        status: 'offered' as const,
      })),
      { onConflict: 'booking_id,cleaner_id', ignoreDuplicates: true }
    )
  }

  const rankedCleaners: RankedCleaner[] = sorted.map((c, i) => ({
    cleanerId: c.id,
    fullName: c.full_name,
    workloadScore: c.workload,
    distanceKm: c.distanceKm,
    finalScore: Math.round(c.finalScore * 100) / 100,
    rank: i + 1,
    dispatched: i < dispatchCount,
  }))

  reasoning.push(`Done. ${toDispatch.length} offer(s) sent.`)

  return { rankedCleaners, dispatched: toDispatch.length, reasoning }
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
  const BUFFER = 120 // 2 hours in minutes
  const newWindowStart = newStart - BUFFER
  const newWindowEnd = newStart + newDuration * 60 + BUFFER
  const existingWindowStart = existingStart - BUFFER
  const existingWindowEnd = existingStart + existingDuration * 60 + BUFFER
  return newWindowStart < existingWindowEnd && newWindowEnd > existingWindowStart
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
