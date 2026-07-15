'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'
import { useBasePath } from '@/components/dashboard/base-path-context'

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getYearOptions() {
  const y = new Date().getFullYear()
  return [y - 1, y, y + 1]
}

function parseMonth(raw: string) {
  if (!raw) return { year: '', mo: '' }
  const [y, m] = raw.split('-')
  return { year: y ?? '', mo: m ?? '' }
}

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </span>
    </div>
  )
}

export default function FiltersBar({
  status: initStatus,
  month: initMonth,
}: {
  status: string
  month: string
}) {
  const router = useRouter()
  const basePath = useBasePath()
  const { year: initYear, mo: initMo } = parseMonth(initMonth)

  const [status, setStatus]   = useState(initStatus || 'pending')
  const [year,   setYear]     = useState(initYear || String(new Date().getFullYear()))
  const [mo,     setMo]       = useState(initMo || '')
  const [loading, setLoading] = useState(false)

  const yearOptions = getYearOptions()

  function buildUrl(overrides?: { status?: string; year?: string; mo?: string }) {
    const s  = overrides?.status ?? status
    const y  = overrides?.year   ?? year
    const m  = overrides?.mo     ?? mo
    const p  = new URLSearchParams()
    p.set('status', s)
    if (m && y) p.set('month', `${y}-${m}`)
    return `${basePath}/day-off-requests?${p.toString()}`
  }

  function apply() {
    setLoading(true)
    router.push(buildUrl())
  }

  function clearMonth() {
    setMo('')
    setLoading(true)
    router.push(buildUrl({ mo: '' }))
  }

  const hasMonth = Boolean(mo)

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Filters</p>

      <div className="flex flex-wrap gap-3 items-end">

        {/* Status */}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Status</label>
          <SelectWrapper>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full appearance-none pl-3 pr-9 py-2.5 text-sm font-medium text-gray-800
                         border border-gray-200 rounded-xl bg-gray-50
                         focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent
                         hover:border-gray-300 transition-colors cursor-pointer"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </SelectWrapper>
        </div>

        {/* Month */}
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Month</label>
          <SelectWrapper>
            <select
              value={mo}
              onChange={(e) => setMo(e.target.value)}
              className="w-full appearance-none pl-3 pr-9 py-2.5 text-sm font-medium text-gray-800
                         border border-gray-200 rounded-xl bg-gray-50
                         focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent
                         hover:border-gray-300 transition-colors cursor-pointer"
            >
              <option value="">Any month</option>
              {MONTH_LABELS.map((label, i) => (
                <option key={i} value={String(i + 1).padStart(2, '0')}>
                  {label}
                </option>
              ))}
            </select>
          </SelectWrapper>
        </div>

        {/* Year */}
        <div className="w-[100px]">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Year</label>
          <SelectWrapper>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              disabled={!mo}
              className="w-full appearance-none pl-3 pr-9 py-2.5 text-sm font-medium text-gray-800
                         border border-gray-200 rounded-xl bg-gray-50
                         focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent
                         hover:border-gray-300 transition-colors cursor-pointer
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </SelectWrapper>
        </div>

        {/* Actions */}
        <div className="flex gap-2 items-center pb-0.5">
          {hasMonth && (
            <button
              type="button"
              onClick={clearMonth}
              className="h-[42px] px-3 text-xs font-semibold text-gray-500 border border-gray-200 rounded-xl
                         hover:border-gray-400 hover:text-gray-700 active:bg-gray-50 transition-all"
            >
              Clear month
            </button>
          )}
          <button
            type="button"
            onClick={apply}
            disabled={loading}
            className="h-[42px] px-5 bg-gray-900 text-white text-sm font-semibold rounded-xl
                       hover:bg-gray-700 active:scale-[0.97] disabled:opacity-60
                       transition-all duration-150 flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Applying…</span>
              </>
            ) : (
              'Apply'
            )}
          </button>
        </div>
      </div>

      {/* Active filter chips */}
      {(status !== 'pending' || hasMonth) && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {status !== 'pending' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-pink-50 text-pink-700 border border-pink-200 text-xs font-semibold rounded-full">
              {status === 'all' ? 'All statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          )}
          {hasMonth && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-pink-50 text-pink-700 border border-pink-200 text-xs font-semibold rounded-full">
              {MONTH_LABELS[parseInt(mo, 10) - 1]} {year}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
