'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { dispatchCleaners, forceAssignCleaner, cancelBooking, getCleanerWeekScheduleData, getConflictingCleanerIds } from '@/app/actions/admin'
import AIDispatchButton from './ai-dispatch-button'
import DeleteBookingButton from './delete-booking-button'
import { haversineKm } from '@/lib/geo'

type Cleaner    = { id: string; full_name: string; phone: string | null; photo_url: string | null }
type Assignment = {
  cleaner_id: string
  status: string
  en_route_at: string | null
  en_route_lat: number | null
  en_route_lng: number | null
  arrived_at: string | null
  arrived_lat: number | null
  arrived_lng: number | null
  profiles: { full_name: string; photo_url: string | null } | null
}
type State      = { error?: string; success?: string } | undefined

const ASSIGNMENT_META: Record<string, { badge: string; dot: string; label: string }> = {
  assigned:  { badge: 'bg-blue-50 text-blue-700 border-blue-200',          dot: 'bg-blue-500',     label: 'Assigned'  },
  declined:  { badge: 'bg-red-50 text-red-600 border-red-200',             dot: 'bg-red-400',      label: 'Declined'  },
  completed: { badge: 'bg-pink-50 text-pink-700 border-pink-200',          dot: 'bg-pink-500',     label: 'Completed' },
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toLocalDateStr(d)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toLocalDateStr(d)
}

function fmtShort(dateStr: string, includeYear = false) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  })
}

const DAY_ABBR = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function fmtGeotagTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })
}

// One-line summary of a cleaner's most recent geotag checkpoint (from the
// mobile "Start Trip" / "I've Arrived" taps — there's no continuous
// tracking, so this is only ever as fresh as the last checkpoint).
function geotagSummary(a: Assignment, serviceLat: number | null, serviceLng: number | null): string | null {
  if (a.arrived_at) {
    const distM = a.arrived_lat != null && a.arrived_lng != null && serviceLat != null && serviceLng != null
      ? Math.round(haversineKm(a.arrived_lat, a.arrived_lng, serviceLat, serviceLng) * 1000)
      : null
    return `Arrived ${fmtGeotagTime(a.arrived_at)}${distM != null ? ` · ${distM}m from address` : ''}`
  }
  if (a.en_route_at) return `En route since ${fmtGeotagTime(a.en_route_at)}`
  return null
}

// ── Schedule data type ───────────────────────────────────────────────────────

type ScheduleData = {
  dayOffs: Array<{ cleaner_id: string; unavailable_date: string }>
  assignments: Array<{
    cleaner_id: string
    booking_id: string
    service_date: string
    booking_status: string
  }>
}

// ── Cleaner Schedule Calendar ────────────────────────────────────────────────

function CleanerScheduleCalendar({
  cleaners,
  serviceDate,
  currentBookingId,
  existingAssignmentIds,
  selectedIds,
  onToggle,
}: {
  cleaners: Cleaner[]
  serviceDate: string
  currentBookingId: string
  existingAssignmentIds: Set<string>
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(serviceDate))
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [allowWeekend, setAllowWeekend] = useState(false)

  const mountedRef   = useRef(true)
  const gridRef      = useRef<HTMLDivElement>(null)
  const slideDirRef  = useRef<'left' | 'right'>('right')
  const isInitialRef = useRef(true)

  useEffect(() => () => { mountedRef.current = false }, [])

  // Slide in when new schedule data arrives
  useEffect(() => {
    if (isInitialRef.current) { isInitialRef.current = false; return }
    const el = gridRef.current
    if (!el) return
    const fromX = slideDirRef.current === 'right' ? 20 : -20
    el.style.transition = 'none'
    el.style.transform  = `translateX(${fromX}px)`
    el.style.opacity    = '0'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.22s cubic-bezier(.25,.8,.25,1), opacity 0.18s ease-out'
        el.style.transform  = 'translateX(0)'
        el.style.opacity    = '1'
      })
    })
  }, [scheduleData])

  function navigate(dir: -1 | 1) {
    slideDirRef.current = dir > 0 ? 'right' : 'left'
    // Slide current grid out
    const el = gridRef.current
    if (el) {
      el.style.transition = 'transform 0.14s ease-in, opacity 0.14s ease-in'
      el.style.transform  = `translateX(${dir > 0 ? -16 : 16}px)`
      el.style.opacity    = '0'
    }
    // Load new week after exit animation starts
    setTimeout(() => {
      setWeekStart(prev => addDays(prev, dir * 7))
    }, 90)
  }

  useEffect(() => {
    setIsLoading(true)
    const ids = cleaners.map(c => c.id)
    getCleanerWeekScheduleData(weekStart, ids)
      .then(data  => { if (mountedRef.current) { setScheduleData(data); setIsLoading(false) } })
      .catch(()   => { if (mountedRef.current) setIsLoading(false) })
  }, [weekStart, cleaners])

  const today = toLocalDateStr(new Date())
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const dayOffSet = new Set(
    (scheduleData?.dayOffs ?? []).map(d => `${d.cleaner_id}:${d.unavailable_date}`)
  )
  const assignMap = new Map<string, string[]>()
  ;(scheduleData?.assignments ?? []).forEach(a => {
    const key = `${a.cleaner_id}:${a.service_date}`
    if (!assignMap.has(key)) assignMap.set(key, [])
    assignMap.get(key)!.push(a.booking_id)
  })

  const weekEnd         = addDays(weekStart, 6)
  const serviceDayOfWeek = new Date(serviceDate + 'T00:00:00').getDay()
  const serviceDayIsWeekend = serviceDayOfWeek === 0

  return (
    <div className="space-y-3">

      {/* Week navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:border-pink-300 hover:bg-pink-50 active:scale-90 transition-all duration-150 shrink-0"
        >
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="flex-1 text-center text-[11px] font-medium text-gray-500">
          {(() => {
            const crossYear = new Date(weekStart + 'T00:00:00').getFullYear() !== new Date(weekEnd + 'T00:00:00').getFullYear()
            return <>{fmtShort(weekStart, crossYear)} – {fmtShort(weekEnd, true)}</>
          })()}
        </span>
        <button
          type="button"
          onClick={() => navigate(1)}
          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:border-pink-300 hover:bg-pink-50 active:scale-90 transition-all duration-150 shrink-0"
        >
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        className={`overflow-hidden ${isLoading ? 'pointer-events-none' : ''}`}
        style={{ willChange: 'transform, opacity' }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left pb-2 w-[88px]" />
              {days.map((day, i) => {
                const isServiceDay = day === serviceDate
                const dayNum = new Date(day + 'T00:00:00').getDate()
                const colIsWeekend = i === 6
                return (
                  <th key={day} className={`w-8 text-center pb-2 relative`}>
                    {isServiceDay && (
                      <div className="absolute inset-x-0 top-0 -bottom-1 bg-pink-50 rounded-t-lg -z-10" />
                    )}
                    <div className={`text-[10px] font-semibold leading-none ${
                      isServiceDay ? 'text-pink-600' : colIsWeekend ? 'text-gray-300' : 'text-gray-400'
                    }`}>
                      {DAY_ABBR[i]}
                    </div>
                    <div className={`text-[11px] leading-tight mt-0.5 font-medium ${
                      isServiceDay ? 'text-pink-700 font-bold' : colIsWeekend ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {dayNum}
                    </div>
                    {isServiceDay && serviceDayIsWeekend && (
                      <div className="mt-0.5 flex justify-center">
                        <span className="text-[8px] font-bold uppercase tracking-wide text-violet-500 bg-violet-50 rounded px-0.5">WKD</span>
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {cleaners.map((cleaner) => (
              <tr key={cleaner.id}>
                <td className="py-1 pr-2">
                  <span
                    className="text-[11px] font-medium text-gray-700 block truncate max-w-[84px]"
                    title={cleaner.full_name}
                  >
                    {cleaner.full_name.split(' ')[0]}
                  </span>
                </td>
                {days.map((day, colIdx) => {
                  const isServiceDay    = day === serviceDate
                  const isOff           = dayOffSet.has(`${cleaner.id}:${day}`)
                  const bookingIdsOnDay = assignMap.get(`${cleaner.id}:${day}`) ?? []
                  const isAlreadyAssigned = existingAssignmentIds.has(cleaner.id) && bookingIdsOnDay.includes(currentBookingId)
                  const hasOtherBooking   = bookingIdsOnDay.some(bid => bid !== currentBookingId)
                  const isSelected        = selectedIds.includes(cleaner.id)
                  const colIsWeekend      = colIdx === 6
                  const isPastDate        = day <= today

                  // Cell appearance — determined before service-day override
                  let cellBg = ''
                  let dotEl: React.ReactNode

                  if (isOff) {
                    cellBg = 'bg-red-50'
                    dotEl = (
                      <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )
                  } else if (isAlreadyAssigned) {
                    cellBg = 'bg-blue-50'
                    dotEl = (
                      <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )
                  } else if (hasOtherBooking) {
                    cellBg = 'bg-amber-50'
                    dotEl = <span className="w-2 h-2 rounded-full bg-amber-400 block" />
                  } else if (colIsWeekend && !isServiceDay) {
                    // Non-service-day weekend: informational only, dimmed
                    cellBg = 'bg-gray-50'
                    dotEl = <span className="w-1.5 h-1.5 rounded-full bg-gray-200 block" />
                  } else if (colIsWeekend && isServiceDay) {
                    // Service day happens to be a weekend — show violet unless blocked
                    cellBg = allowWeekend ? 'bg-violet-50' : 'bg-violet-50/60'
                    dotEl = <span className="w-2 h-2 rounded-full bg-violet-300 block" />
                  } else if (isPastDate) {
                    cellBg = 'bg-gray-50'
                    dotEl = <span className="w-1.5 h-1.5 rounded-full bg-gray-200 block" />
                  } else {
                    cellBg = 'bg-emerald-50'
                    dotEl = <span className="w-2 h-2 rounded-full bg-emerald-400 block" />
                  }

                  // ── Service day column: interactive ──────────────────────
                  if (isServiceDay) {
                    const isWeekendCell = colIdx === 5 || colIdx === 6
                    // Weekend cells need the toggle enabled; other blocks as usual
                    const clickable = !isOff && !isAlreadyAssigned && day >= today && (!isWeekendCell || allowWeekend)
                    const isActive  = isSelected && clickable

                    return (
                      <td key={day} className="text-center bg-pink-50 relative">
                        <button
                          type="button"
                          disabled={!clickable}
                          onClick={() => onToggle(cleaner.id)}
                          title={
                            isOff
                              ? 'Day off — cannot assign'
                              : isAlreadyAssigned
                                ? 'Already assigned to this booking'
                                : isWeekendCell && !allowWeekend
                                  ? 'Weekend — enable "Force on weekend" to assign'
                                  : hasOtherBooking
                                    ? 'Has another booking — click to select anyway'
                                    : isWeekendCell
                                      ? 'Weekend assignment — click to select'
                                      : 'Available — click to select'
                          }
                          className={[
                            'w-7 h-7 mx-auto rounded-lg flex items-center justify-center transition-all duration-150',
                            isActive
                              ? 'bg-pink-600 ring-2 ring-pink-300 shadow-sm scale-105'
                              : clickable
                                ? `${cellBg} hover:ring-2 hover:ring-pink-300 hover:scale-105 cursor-pointer`
                                : `${cellBg} cursor-not-allowed opacity-50`,
                          ].join(' ')}
                        >
                          {isActive ? (
                            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : isWeekendCell && !allowWeekend && !isOff && !isAlreadyAssigned ? (
                            <svg className="w-3 h-3 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          ) : dotEl}
                        </button>
                      </td>
                    )
                  }

                  // ── Non-service day: read-only ───────────────────────────
                  return (
                    <td key={day} className="text-center">
                      <div className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center ${cellBg}`}>
                        {dotEl}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Weekend toggle — only visible when the service day is a weekend */}
      {serviceDayIsWeekend && (
        <label className="flex items-center gap-2 cursor-pointer select-none group">
          <div
            onClick={() => setAllowWeekend(v => !v)}
            className={[
              'relative w-8 h-4 rounded-full transition-colors duration-200 shrink-0',
              allowWeekend ? 'bg-violet-500' : 'bg-gray-200',
            ].join(' ')}
          >
            <span className={[
              'absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200',
              allowWeekend ? 'translate-x-4' : 'translate-x-0',
            ].join(' ')} />
          </div>
          <span className="text-[11px] text-gray-500 group-hover:text-gray-700 transition-colors">
            Force assign on weekend
          </span>
          {allowWeekend && (
            <span className="text-[10px] text-violet-600 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-full font-medium">
              Overtime rates may apply
            </span>
          )}
        </label>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-[10px] text-gray-400">Free</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span className="text-[10px] text-gray-400">Busy</span>
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="text-[10px] text-gray-400">Day off</span>
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="text-[10px] text-gray-400">Assigned</span>
        </div>
        {serviceDayIsWeekend && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-violet-300 shrink-0" />
            <span className="text-[10px] text-gray-400">Weekend</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-pink-100 shrink-0" />
          <span className="text-[10px] text-pink-500 font-medium">Service day</span>
        </div>
      </div>

    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────

export default function DispatchPanel({
  bookingId,
  bookingStatus,
  paymentStatus,
  paymentMethod,
  serviceDate,
  serviceLat,
  serviceLng,
  cleaners,
  assignments,
}: {
  bookingId: string
  bookingStatus: string
  paymentStatus: string
  paymentMethod: string
  serviceDate: string
  serviceLat: number | null
  serviceLng: number | null
  cleaners: Cleaner[]
  assignments: Assignment[]
}) {
  const [dispatchState, dispatchAction, dispatchPending] = useActionState<State, FormData>(dispatchCleaners, undefined)
  const [cancelState,   cancelAction,   cancelPending]   = useActionState<State, FormData>(cancelBooking, undefined)
  const [calendarState, calendarAction, calendarPending] = useActionState<State, FormData>(forceAssignCleaner, undefined)

  const [selected,            setSelected]            = useState<string[]>([])
  const [calendarSelectedIds, setCalendarSelectedIds] = useState<string[]>([])
  const [conflictWindows,     setConflictWindows]     = useState<Map<string, string>>(new Map())

  // Same conflict rule the server enforces before writing (findConflictingCleaners,
  // ±2h buffer) — fetched once so the manual list can gray out cleaners who'd
  // just be rejected anyway instead of only finding out after submitting. A
  // cleaner with a non-overlapping job earlier/later the same day is not
  // included here and stays fully selectable.
  useEffect(() => {
    let cancelled = false
    getConflictingCleanerIds(bookingId).then((conflicts) => {
      if (!cancelled) setConflictWindows(new Map(conflicts.map((c) => [c.cleanerId, c.conflictWindow])))
    })
    return () => { cancelled = true }
  }, [bookingId])

  const activelyAssigned     = new Set(assignments.filter((a) => a.status === 'assigned').map((a) => a.cleaner_id))
  const availableForDispatch = cleaners.filter((c) => !activelyAssigned.has(c.id))
  const isClosed             = bookingStatus === 'completed' || bookingStatus === 'cancelled'
  const isPaymentBlocked     = paymentStatus !== 'paid' && paymentMethod !== 'cash'

  const toggle = (id: string) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const toggleCalendar = (id: string) =>
    setCalendarSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  return (
    <div className="space-y-6">

      {/* ── Current assignments ──────────────────────────────────── */}
      {assignments.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Assignments
          </p>
          <div className="space-y-1.5">
            {assignments.map((a) => {
              const m = ASSIGNMENT_META[a.status] ?? { badge: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400', label: a.status }
              const geotag = geotagSummary(a, serviceLat, serviceLng)
              return (
                <div key={a.cleaner_id} className="flex items-center gap-3 py-1.5">
                  {a.profiles?.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.profiles.photo_url}
                      alt={a.profiles.full_name ?? 'Cleaner'}
                      className="w-8 h-8 rounded-full object-cover border border-gray-200 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0 select-none">
                      {a.profiles?.full_name?.charAt(0).toUpperCase() ?? '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {a.profiles?.full_name ?? 'Cleaner'}
                    </p>
                    {geotag && (
                      <p className="text-[11px] text-gray-400 truncate">{geotag}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border shrink-0 ${m.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                    {m.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!isClosed && (
        <>
          {assignments.length > 0 && <div className="border-t border-gray-100" />}

          {/* ── Cleaner Schedule Calendar ─────────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Cleaner Schedule
            </p>

            {cleaners.length === 0 ? (
              <p className="text-xs text-gray-400">No active cleaners to display.</p>
            ) : (
              <>
                <CleanerScheduleCalendar
                  cleaners={cleaners}
                  serviceDate={serviceDate}
                  currentBookingId={bookingId}
                  existingAssignmentIds={activelyAssigned}
                  selectedIds={calendarSelectedIds}
                  onToggle={toggleCalendar}
                />

                {/* Schedule-based assignment form */}
                {calendarSelectedIds.length > 0 && !isPaymentBlocked && (
                  <form action={calendarAction} className="mt-4 space-y-2">
                    <input type="hidden" name="booking_id" value={bookingId} />
                    {calendarSelectedIds.map((id) => (
                      <input key={id} type="hidden" name="cleaner_id" value={id} />
                    ))}

                    {/* Selected chips */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {calendarSelectedIds.map((id) => {
                        const c = cleaners.find(x => x.id === id)
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-[11px] font-medium bg-pink-50 text-pink-700 border border-pink-200 rounded-full"
                          >
                            {c?.full_name.split(' ')[0] ?? 'Cleaner'}
                            <button
                              type="button"
                              onClick={() => toggleCalendar(id)}
                              className="w-4 h-4 rounded-full hover:bg-pink-200 flex items-center justify-center transition-colors"
                            >
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        )
                      })}
                    </div>

                    <button
                      type="submit"
                      disabled={calendarPending}
                      className="w-full py-2.5 bg-pink-600 text-white rounded-xl text-sm font-semibold hover:bg-pink-700 hover:shadow-md active:scale-[0.98] disabled:opacity-40 transition-all duration-150 flex items-center justify-center gap-2"
                    >
                      {calendarPending ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        `Confirm & Assign ${calendarSelectedIds.length} Cleaner${calendarSelectedIds.length > 1 ? 's' : ''}`
                      )}
                    </button>
                  </form>
                )}

                {calendarSelectedIds.length > 0 && isPaymentBlocked && (
                  <p className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                    Mark payment as <strong>Paid</strong> to confirm this assignment.
                  </p>
                )}

                {calendarState?.error && (
                  <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{calendarState.error}</p>
                )}
              </>
            )}
          </div>

          <div className="border-t border-gray-100" />

          {/* ── AI Dispatch ─────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              AI Dispatch
            </p>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Rule-based AI for manpower estimation and cleaner deployment — evaluates availability, workload, proximity, and performance to assign the right cleaners to each job.
            </p>
            <AIDispatchButton bookingId={bookingId} serviceDate={serviceDate} disabled={isPaymentBlocked} />
          </div>

          {/* ── Payment gate (manual + force assign) ─────────────── */}
          {isPaymentBlocked ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 space-y-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-xs font-semibold text-amber-700">Payment required to dispatch</p>
              </div>
              <p className="text-xs text-amber-600 leading-relaxed">
                This booking&apos;s payment status is <span className="font-semibold capitalize">{paymentStatus}</span>.
                Mark the payment as <span className="font-semibold">Paid</span> in the Payment section below before running Manual Dispatch or Confirm Assignment.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-gray-100" />
                <span className="text-[11px] text-gray-300 font-medium tracking-wide">or</span>
                <div className="flex-1 border-t border-gray-100" />
              </div>

              {/* ── Manual Dispatch ─────────────────────────────── */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Dispatch Cleaners
                </p>
                <div className="space-y-3">
                  {availableForDispatch.length > 0 ? (
                    <>
                      <div className="space-y-1.5">
                        {availableForDispatch.map((c) => {
                          const isSelected = selected.includes(c.id)
                          const conflictWindow = conflictWindows.get(c.id)
                          const isConflicting = conflictWindow != null
                          return (
                            <label
                              key={c.id}
                              title={isConflicting ? `Has an assigned job ${conflictWindow} that overlaps this booking’s time.` : undefined}
                              className={`flex items-center gap-3 p-3 border rounded-xl transition-all ${
                                isConflicting
                                  ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                                  : isSelected
                                    ? 'border-pink-400 bg-pink-50 cursor-pointer'
                                    : 'border-gray-200 hover:border-gray-300 bg-white cursor-pointer'
                              }`}
                            >
                              <input
                                type="checkbox" checked={isSelected} disabled={isConflicting}
                                onChange={() => toggle(c.id)} className="sr-only"
                              />
                              {c.photo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={c.photo_url}
                                  alt={c.full_name}
                                  className={`w-7 h-7 rounded-full object-cover shrink-0 border ${
                                    isConflicting ? 'grayscale border-gray-200' : isSelected ? 'border-pink-500 ring-2 ring-pink-300' : 'border-gray-200'
                                  }`}
                                />
                              ) : (
                                <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
                                  isConflicting ? 'bg-gray-200 text-gray-500' : isSelected ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {c.full_name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${isConflicting ? 'text-gray-500' : 'text-gray-900'}`}>{c.full_name}</p>
                                {isConflicting ? (
                                  <p className="text-[11px] text-gray-400">Busy {conflictWindow}</p>
                                ) : c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                              </div>
                              {isSelected && !isConflicting && (
                                <svg className="w-4 h-4 text-pink-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </label>
                          )
                        })}
                      </div>
                      <form action={dispatchAction}>
                        <input type="hidden" name="booking_id" value={bookingId} />
                        {selected.map((id) => (
                          <input key={id} type="hidden" name="cleaner_ids" value={id} />
                        ))}
                        <button
                          type="submit"
                          disabled={dispatchPending || selected.length === 0}
                          className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 hover:shadow-md active:scale-[0.98] disabled:opacity-40 transition-all duration-150"
                        >
                          {dispatchPending
                            ? 'Assigning...'
                            : selected.length > 0
                              ? `Assign ${selected.length} Cleaner${selected.length > 1 ? 's' : ''}`
                              : 'Select cleaners above'}
                        </button>
                      </form>
                      {dispatchState?.success && (
                        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">{dispatchState.success}</p>
                      )}
                      {dispatchState?.error && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{dispatchState.error}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 py-1">All active cleaners have already been assigned to this job.</p>
                  )}
                </div>
              </div>

            </>
          )}

          {/* ── Cancel Booking ──────────────────────────────────── */}
          {(bookingStatus === 'pending' || bookingStatus === 'confirmed') && (
            <>
              <div className="border-t border-gray-100" />
              <div>
                <p className="text-[11px] font-semibold text-red-400 uppercase tracking-widest mb-3">
                  Cancel Booking
                </p>
                <form action={cancelAction} className="space-y-3">
                  <input type="hidden" name="booking_id" value={bookingId} />
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">
                      Transportation fee (₱) — optional, charged to customer
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none select-none">₱</span>
                      <input
                        type="number"
                        name="cancellation_fee"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent focus:bg-white transition-colors"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={cancelPending}
                    className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
                  >
                    {cancelPending ? 'Cancelling...' : 'Cancel this booking'}
                  </button>
                </form>
                {cancelState?.error && (
                  <p className="mt-2 text-xs text-red-600">{cancelState.error}</p>
                )}
              </div>
            </>
          )}

          {/* ── Delete Booking ───────────────────────────────────── */}
          <div className="border-t border-gray-100 pt-5">
            <DeleteBookingButton bookingId={bookingId} />
          </div>
        </>
      )}

      {/* ── Closed state ────────────────────────────────────────── */}
      {isClosed && (
        <div className="space-y-5">
          <div className="py-6 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500 capitalize">{bookingStatus}</p>
            <p className="text-xs text-gray-400 mt-0.5">Waiting for customer review.</p>
          </div>
          <div className="border-t border-gray-100 pt-5">
            <DeleteBookingButton bookingId={bookingId} />
          </div>
        </div>
      )}

    </div>
  )
}
