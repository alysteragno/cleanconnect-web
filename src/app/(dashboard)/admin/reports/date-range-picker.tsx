'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBasePath } from '@/components/dashboard/base-path-context'

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const PRESETS = [
  { label: 'Last 7 days', days: 6 },
  { label: 'Last 30 days', days: 29 },
  { label: 'Last 90 days', days: 89 },
]

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fromISO(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function fmtLabel(s: string) {
  return fromISO(s).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function CustomRangeTab({ active, start, end }: { active: boolean; start: string; end: string }) {
  const router = useRouter()
  const basePath = useBasePath()
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [rangeStart, setRangeStart] = useState(start)
  const [rangeEnd, setRangeEnd] = useState(end)
  const [placing, setPlacing] = useState<'start' | 'end'>('start')
  const [hover, setHover] = useState<string | null>(null)
  const [viewMonth, setViewMonth] = useState(() => { const d = fromISO(start); d.setDate(1); return d })
  const ref = useRef<HTMLDivElement>(null)
  const todayISO = toISO(new Date())

  function closeDropdown() { setClosing(true) }

  useEffect(() => {
    if (!open && !closing) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) closeDropdown()
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open, closing])

  function openPicker() {
    setRangeStart(start)
    setRangeEnd(end)
    setPlacing('start')
    const d = fromISO(start); d.setDate(1)
    setViewMonth(d)
    setOpen(true)
  }

  function pickDay(iso: string) {
    if (iso > todayISO) return
    if (placing === 'start') {
      setRangeStart(iso)
      setRangeEnd(iso)
      setPlacing('end')
    } else if (iso < rangeStart) {
      setRangeStart(iso)
      setRangeEnd(iso)
    } else {
      setRangeEnd(iso)
      setPlacing('start')
    }
  }

  function applyPreset(days: number) {
    const end = new Date()
    const s = new Date(); s.setDate(end.getDate() - days)
    setRangeStart(toISO(s))
    setRangeEnd(toISO(end))
    setPlacing('start')
    const d = new Date(s); d.setDate(1)
    setViewMonth(d)
  }

  function apply() {
    closeDropdown()
    router.push(`${basePath}/reports?period=custom&start=${rangeStart}&end=${rangeEnd}`, { scroll: false })
  }

  const weeks = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
    const gridStart = new Date(first); gridStart.setDate(first.getDate() - first.getDay())
    return Array.from({ length: 6 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const day = new Date(gridStart)
        day.setDate(gridStart.getDate() + w * 7 + d)
        return day
      })
    )
  }, [viewMonth])

  const previewEnd = placing === 'end' && hover && hover > rangeStart ? hover : rangeEnd

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (open ? closeDropdown() : openPicker())}
        className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 whitespace-nowrap ${
          active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        {active ? `${fmtLabel(start)} – ${fmtLabel(end)}` : 'Custom Range'}
      </button>

      {(open || closing) && (
        <div
          className={`absolute left-0 top-full mt-2 z-50 w-[300px] bg-white border border-gray-200 rounded-2xl shadow-lg shadow-gray-200/60 p-4 ${closing ? 'animate-dropdown-out' : 'animate-dropdown-in'}`}
          onAnimationEnd={() => { if (closing) { setClosing(false); setOpen(false) } }}
        >
          <div className="flex flex-wrap gap-1.5 mb-3">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.days)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-50 text-gray-600 border border-gray-200 hover:border-pink-300 hover:text-pink-700 hover:bg-pink-50 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d })}
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              ‹
            </button>
            <p className="text-xs font-semibold text-gray-800">
              {MONTH_LABELS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </p>
            <button
              type="button"
              onClick={() => setViewMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d })}
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((d) => (
              <p key={d} className="text-[10px] font-semibold text-gray-300 text-center py-1">{d}</p>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5" onMouseLeave={() => setHover(null)}>
            {weeks.flat().map((day) => {
              const iso = toISO(day)
              const inMonth = day.getMonth() === viewMonth.getMonth()
              const isFuture = iso > todayISO
              const isStart = iso === rangeStart
              const isEnd = iso === previewEnd
              const inRange = iso > rangeStart && iso < previewEnd
              const isToday = iso === todayISO
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={isFuture}
                  onClick={() => pickDay(iso)}
                  onMouseEnter={() => setHover(iso)}
                  className={`relative h-7 text-[11px] flex items-center justify-center transition-colors
                    ${!inMonth ? 'text-gray-300' : isFuture ? 'text-gray-200 cursor-not-allowed' : 'text-gray-700'}
                    ${inRange ? 'bg-pink-50' : ''}
                    ${isStart || isEnd ? 'bg-pink-600 text-white font-semibold rounded-full z-10' : 'rounded-full hover:bg-pink-50'}
                    ${isToday && !isStart && !isEnd ? 'ring-1 ring-inset ring-pink-300' : ''}
                  `}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <p className="text-[11px] text-gray-400">
              {rangeStart === rangeEnd ? fmtLabel(rangeStart) : `${fmtLabel(rangeStart)} – ${fmtLabel(rangeEnd)}`}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={closeDropdown} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={apply} className="px-3 py-1.5 bg-pink-600 text-white rounded-lg text-xs font-semibold hover:bg-pink-700 transition-colors">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
