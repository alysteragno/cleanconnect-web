import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import { SortSelect } from '@/components/dashboard/sort-select'
import { PeriodSelect } from '@/components/dashboard/period-select'
import { Pagination } from '@/components/dashboard/pagination'
import { paginate, resolvePage } from '@/utils/pagination'

const PAGE_SIZE = 10

type Feedback = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  bookings: {
    service_date: string
    service_name: string | null
  } | null
  profiles: { full_name: string } | null
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? 'text-yellow-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  )
}

const SORT_OPTIONS = [
  { value: 'date_desc',   label: 'Newest First' },
  { value: 'date_asc',    label: 'Oldest First' },
  { value: 'rating_desc', label: 'Rating (High → Low)' },
  { value: 'rating_asc',  label: 'Rating (Low → High)' },
]

// Feedback is only ever created after the fact (a customer reviewing a
// completed booking), so unlike Bookings there's no "Next Week"/"Next
// Month" — every preset here is bounded to the present or the past.
const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week',  label: 'This Week' },
  { value: 'month', label: 'This Month' },
] as const
const ALL_TIME = { value: 'all', label: 'All Time' } as const
type Period = (typeof PERIODS)[number]['value'] | typeof ALL_TIME.value
const DEFAULT_PERIOD: Period = 'all'
const VALID_PERIODS = new Set<string>([...PERIODS.map((p) => p.value), ALL_TIME.value])

type DateRange = { start: string; end: string }

function getDateRange(period: Period): DateRange | null {
  // Always derive dates in Philippines time (UTC+8), matching /admin/bookings.
  const phToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) // 'YYYY-MM-DD'
  const noonPH = (iso: string) => new Date(`${iso}T12:00:00+08:00`)
  const toISO = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const pad = (n: number) => String(n).padStart(2, '0')

  switch (period) {
    case 'today': return { start: phToday, end: phToday }
    case 'week': {
      const n = noonPH(phToday)
      const dow = n.getDay() // 0=Sun
      const diffToMon = dow === 0 ? -6 : 1 - dow
      const mon = new Date(n); mon.setDate(n.getDate() + diffToMon)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      return { start: toISO(mon), end: toISO(sun) }
    }
    case 'month': {
      const [y, mo] = phToday.split('-').map(Number) // mo is 1-indexed
      const lastDay = new Date(y, mo, 0).getDate()
      return { start: `${y}-${pad(mo)}-01`, end: `${y}-${pad(mo)}-${pad(lastDay)}` }
    }
    default: // 'all'
      return null
  }
}

function rangeSubtitle(range: DateRange): string {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
  return range.start === range.end ? fmt(range.start) : `${fmt(range.start)} – ${fmt(range.end)}`
}

// created_at is a timestamptz — convert to a PH calendar date before
// comparing against the (PH-local) range boundaries.
function toPHDateISO(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

// Builds a feedback-list href from the current filter state with one or
// more fields overridden, always dropping `page` since the result set just
// changed.
function hrefWith(
  basePath: string,
  current: { sort?: string; period?: string; rating?: string },
  overrides: Partial<typeof current>
) {
  const merged = { ...current, ...overrides }
  const params = new URLSearchParams()
  if (merged.sort) params.set('sort', merged.sort)
  if (merged.period && merged.period !== DEFAULT_PERIOD) params.set('period', merged.period)
  if (merged.rating) params.set('rating', merged.rating)
  const qs = params.toString()
  return `${basePath}/feedback${qs ? `?${qs}` : ''}`
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; page?: string; period?: string; rating?: string }>
}) {
  const { sort, page: rawPage, period: rawPeriod, rating: rawRating } = await searchParams
  const supabase = await createClient()
  const basePath = await getBasePath()

  const { data: feedbackRows } = await supabase
    .from('feedback')
    .select('id, rating, comment, created_at, bookings (service_date, service_name), profiles!customer_id (full_name)')
    .order('created_at', { ascending: false })

  const unsorted = (feedbackRows ?? []) as unknown as Feedback[]

  const period: Period = VALID_PERIODS.has(rawPeriod ?? '') ? (rawPeriod as Period) : DEFAULT_PERIOD
  const range = getDateRange(period)
  const current = { sort, period, rating: rawRating }

  const scoped = range
    ? unsorted.filter((f) => {
        const d = toPHDateISO(f.created_at)
        return d >= range.start && d <= range.end
      })
    : unsorted

  const avg = scoped.length > 0
    ? (scoped.reduce((s, f) => s + f.rating, 0) / scoped.length).toFixed(1)
    : '—'

  const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const f of scoped) ratingCounts[f.rating] = (ratingCounts[f.rating] ?? 0) + 1

  const ratingFilter = rawRating && ['1', '2', '3', '4', '5'].includes(rawRating) ? Number(rawRating) : undefined
  const ratingScoped = ratingFilter ? scoped.filter((f) => f.rating === ratingFilter) : scoped

  const sortKey = sort ?? 'date_desc'
  const list = [...ratingScoped].sort((a, b) => {
    switch (sortKey) {
      case 'date_asc':    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'rating_desc': return b.rating - a.rating
      case 'rating_asc':  return a.rating - b.rating
      default:            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
  })

  const page = resolvePage(rawPage, list.length, PAGE_SIZE)
  const pageItems = paginate(list, page, PAGE_SIZE)

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href={basePath || '/'} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Dashboard</Link>
        <div className="flex items-baseline justify-between mt-2">
          <h1 className="text-xl font-bold text-gray-900">Customer Feedback</h1>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-yellow-500">★</span>
            <span className="text-lg font-bold text-gray-900">{avg}</span>
            <span className="text-sm text-gray-400">/ 5 ({scoped.length} {scoped.length === 1 ? 'review' : 'reviews'})</span>
          </div>
        </div>
      </div>

      {/* Period filter: bounded presets in a dropdown, plus the open-ended "All Time" option */}
      <div className="flex flex-wrap items-center gap-2">
        <PeriodSelect options={PERIODS} activeValue={period} defaultValue={DEFAULT_PERIOD} />
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <Link
            href={hrefWith(basePath, current, { period: ALL_TIME.value })}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              period === ALL_TIME.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {ALL_TIME.label}
          </Link>
        </div>
      </div>
      {range && (
        <p className="text-xs text-gray-400 -mt-3">{rangeSubtitle(range)}</p>
      )}

      {/* Rating distribution — each row is a clickable filter chip */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rating Distribution</p>
          {ratingFilter && (
            <Link href={hrefWith(basePath, current, { rating: undefined })} className="text-xs text-pink-600 hover:underline font-medium">
              Clear filter
            </Link>
          )}
        </div>
        <div className="space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = ratingCounts[star] ?? 0
            const pct = scoped.length > 0 ? (count / scoped.length) * 100 : 0
            const isActive = ratingFilter === star
            return (
              <Link
                key={star}
                href={hrefWith(basePath, current, { rating: isActive ? undefined : String(star) })}
                className={`flex items-center gap-3 rounded-lg px-1.5 py-1.5 -mx-1.5 transition-colors ${
                  isActive ? 'bg-pink-50' : 'hover:bg-gray-50'
                }`}
              >
                <span className={`text-sm w-8 shrink-0 ${isActive ? 'text-pink-700 font-semibold' : 'text-gray-600'}`}>{star} ★</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${isActive ? 'bg-pink-500' : 'bg-yellow-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-xs w-6 text-right ${isActive ? 'text-pink-600 font-semibold' : 'text-gray-400'}`}>{count}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Reviews list */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-gray-900">
            All Reviews
            {ratingFilter && <span className="text-gray-400 font-normal"> · {ratingFilter}★ only</span>}
          </p>
          {list.length > 0 && <SortSelect options={SORT_OPTIONS} />}
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">
            {scoped.length === 0 ? 'No feedback in this period.' : 'No reviews match this rating.'}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {pageItems.map((f) => (
              <div key={f.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div>
                    <Stars rating={f.rating} />
                    <p className="text-xs text-gray-400 mt-1">
                      {f.profiles?.full_name ?? 'Customer'} ·{' '}
                      {f.bookings?.service_name ?? 'Service'}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 shrink-0">
                    {new Date(f.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}
                  </p>
                </div>
                {f.comment && (
                  <p className="text-sm text-gray-700 italic mt-2">&ldquo;{f.comment}&rdquo;</p>
                )}
              </div>
            ))}
          </div>
        )}
        <Pagination totalItems={list.length} pageSize={PAGE_SIZE} />
      </div>
    </div>
  )
}
