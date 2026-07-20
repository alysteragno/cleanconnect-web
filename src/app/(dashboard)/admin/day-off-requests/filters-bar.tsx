'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useBasePath } from '@/components/dashboard/base-path-context'
import { SelectDropdown } from '@/components/dashboard/select-dropdown'

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATUS_OPTIONS = [
  { value: 'all',      label: 'All statuses' },
  { value: 'pending',  label: 'Pending' },
  { value: 'expired',  label: 'Expired' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const MONTH_OPTIONS = [
  { value: '', label: 'Any month' },
  ...MONTH_LABELS.map((label, i) => ({ value: String(i + 1).padStart(2, '0'), label })),
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
          <SelectDropdown value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </div>

        {/* Month */}
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Month</label>
          <SelectDropdown value={mo} onChange={setMo} options={MONTH_OPTIONS} placeholder="Any month" />
        </div>

        {/* Year */}
        <div className="w-[100px]">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Year</label>
          <SelectDropdown
            value={year}
            onChange={setYear}
            disabled={!mo}
            options={yearOptions.map((y) => ({ value: String(y), label: String(y) }))}
          />
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
