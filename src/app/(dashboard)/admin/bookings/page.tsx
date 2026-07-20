import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import { SortSelect } from '@/components/dashboard/sort-select'
import { PeriodSelect } from '@/components/dashboard/period-select'
import { CustomRangeTab } from '@/components/dashboard/custom-range-tab'
import { Pagination } from '@/components/dashboard/pagination'
import { resolvePage } from '@/utils/pagination'
import { paymentStatusLabel } from '@/lib/booking-pricing'

const PAGE_SIZE = 10
function getServiceImage(name: string | null): string | null {
  if (!name) return null
  const n = name.toLowerCase()
  if (n.includes('aircon') || n.includes('air con') || n.includes('air conditioning')) {
    if (n.includes('repair')) return '/service_image/aircon_repair.webp'
    return '/service_image/aircon_cleaning.webp'
  }
  if (n.includes('sofa') || n.includes('couch')) return '/service_image/sofa_deepcleaning.webp'
  if (n.includes('carpet')) return '/service_image/carpet_cleaning.webp'
  if (n.includes('curtain')) return '/service_image/curtain_drycleaning.webp'
  if (n.includes('mattress')) return '/service_image/mattress_deepCleaning.webp'
  if (n.includes('grease') || n.includes('greasetrap')) {
    if (n.includes('install')) return '/service_image/greasetrap_installation.webp'
    return '/service_image/greasetrap.webp'
  }
  if (n.includes('post') || n.includes('construction')) return '/service_image/post_construction.webp'
  if (n.includes('office')) return '/service_image/office_cleaning.webp'
  if (n.includes('condo')) return '/service_image/condo_cleaning.jpeg'
  if (n.includes('general')) return '/service_image/general_cleaning.webp'
  return null
}

type Booking = {
  id: string
  created_at: string
  service_date: string
  service_time: string
  service_name: string | null
  property_sqm: number
  base_price: number
  status: string
  payment_status: string
  payment_method: string
  address_city: string | null
  profiles: { full_name: string } | null
}

const STATUS_META: Record<string, { dot: string; pill: string; label: string }> = {
  pending:     { dot: 'bg-yellow-400', pill: 'bg-yellow-50 text-yellow-700 border-yellow-200',   label: 'Pending' },
  confirmed:   { dot: 'bg-pink-500',   pill: 'bg-pink-50 text-pink-700 border-pink-200',         label: 'Confirmed' },
  in_progress: { dot: 'bg-purple-500', pill: 'bg-purple-50 text-purple-700 border-purple-200',   label: 'In Progress' },
  completed:   { dot: 'bg-green-500',  pill: 'bg-green-50 text-green-700 border-green-200',      label: 'Completed' },
  cancelled:   { dot: 'bg-red-400',    pill: 'bg-red-50 text-red-600 border-red-200',            label: 'Cancelled' },
}

const PAYMENT_STYLES: Record<string, string> = {
  unpaid:   'bg-red-50 text-red-600 border-red-200',
  paid:     'bg-green-50 text-green-600 border-green-200',
  refunded: 'bg-blue-50 text-blue-600 border-blue-200',
  partial:  'bg-amber-50 text-amber-600 border-amber-200',
}

const STATUS_OPTS = [
  { value: '',            label: 'All' },
  { value: 'pending',     label: 'Pending' },
  { value: 'confirmed',   label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
]

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}
function formatBookedAt(ts: string) {
  return new Date(ts).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Manila',
  })
}

const SORT_OPTIONS = [
  { value: 'booked_desc',  label: 'Booked Date (Newest)' },
  { value: 'booked_asc',   label: 'Booked Date (Oldest)' },
  { value: 'date_desc',    label: 'Service Date (Newest)' },
  { value: 'date_asc',     label: 'Service Date (Oldest)' },
  { value: 'price_desc',   label: 'Price (High → Low)' },
  { value: 'price_asc',    label: 'Price (Low → High)' },
]

// Period filter by service_date (the schedule field — "next week" only makes
// sense against when a job happens, not when it was booked) instead of
// loading every row and slicing in memory. Default is bounded rather than
// "all bookings ever" so the query stays cheap as the table grows.
// The bounded presets live in one dropdown for a tidier filter row; "All
// Time" and "Custom Range" stay as their own controls since they're the two
// unbounded/open-ended escape hatches, not part of the everyday preset list.
const PERIODS = [
  { value: 'past3',     label: 'Past 3 Days'  },
  { value: 'today',     label: 'Today'        },
  { value: 'week',      label: 'This Week'    },
  { value: 'nextWeek',  label: 'Next Week'    },
  { value: 'month',     label: 'This Month'   },
  { value: 'nextMonth', label: 'Next Month'   },
] as const
const ALL_TIME = { value: 'all', label: 'All Time' } as const
type Period = (typeof PERIODS)[number]['value'] | typeof ALL_TIME.value | 'custom'
// "This Week" rather than "Past 3 Days" — still bounded, but a 3-day window
// reads as broken ("no bookings found") on any day without recent activity.
const DEFAULT_PERIOD: Period = 'week'
const VALID_PERIODS = new Set<string>([...PERIODS.map((p) => p.value), ALL_TIME.value, 'custom'])

type DateRange = { start: string; end: string }

function getDateRange(period: Period, custom?: { start?: string; end?: string }): DateRange | null {
  // Always derive dates in Philippines time (UTC+8), matching /admin/reports.
  const phToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) // 'YYYY-MM-DD'
  const noonPH = (iso: string) => new Date(`${iso}T12:00:00+08:00`)
  const toISO = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const pad = (n: number) => String(n).padStart(2, '0')

  const weekOf = (offsetWeeks: number) => {
    const n = noonPH(phToday)
    const dow = n.getDay() // 0=Sun
    const diffToMon = (dow === 0 ? -6 : 1 - dow) + offsetWeeks * 7
    const mon = new Date(n); mon.setDate(n.getDate() + diffToMon)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { start: toISO(mon), end: toISO(sun) }
  }
  const monthOf = (offsetMonths: number) => {
    const [y, mo] = phToday.split('-').map(Number) // mo is 1-indexed
    const d = new Date(y, mo - 1 + offsetMonths, 1)
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    return { start: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, end: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(lastDay)}` }
  }

  switch (period) {
    case 'today':     return { start: phToday, end: phToday }
    case 'past3': {
      const start = noonPH(phToday); start.setDate(start.getDate() - 2)
      return { start: toISO(start), end: phToday }
    }
    case 'week':      return weekOf(0)
    case 'nextWeek':  return weekOf(1)
    case 'month':     return monthOf(0)
    case 'nextMonth': return monthOf(1)
    case 'custom': {
      if (custom?.start && custom?.end) {
        return custom.start <= custom.end
          ? { start: custom.start, end: custom.end }
          : { start: custom.end, end: custom.start }
      }
      // No range chosen yet — default to the last 30 days until picked.
      const start = noonPH(phToday); start.setDate(start.getDate() - 29)
      return { start: toISO(start), end: phToday }
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

// Builds a bookings-list href from the current filter state with one or more
// fields overridden, always dropping `page` since the result set just changed.
function hrefWith(
  basePath: string,
  current: { status?: string; sort?: string; period?: string; start?: string; end?: string },
  overrides: Partial<typeof current>
) {
  const merged = { ...current, ...overrides }
  const params = new URLSearchParams()
  if (merged.status) params.set('status', merged.status)
  if (merged.sort) params.set('sort', merged.sort)
  if (merged.period && merged.period !== DEFAULT_PERIOD) params.set('period', merged.period)
  if (merged.period === 'custom') {
    if (merged.start) params.set('start', merged.start)
    if (merged.end) params.set('end', merged.end)
  }
  const qs = params.toString()
  return `${basePath}/bookings${qs ? `?${qs}` : ''}`
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string; page?: string; period?: string; start?: string; end?: string }>
}) {
  const { status, sort, page: rawPage, period: rawPeriod, start: rawStart, end: rawEnd } = await searchParams
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const basePath = await getBasePath()
  const supabase = createAdminClient()

  const period: Period = VALID_PERIODS.has(rawPeriod ?? '') ? (rawPeriod as Period) : DEFAULT_PERIOD
  const range = getDateRange(period, { start: rawStart, end: rawEnd })
  const sortKey = sort ?? 'booked_desc'
  const current = { status, sort, period, start: rawStart, end: rawEnd }

  // Status counts scoped to the selected period — head-only counts (no row
  // data ever transferred), so "All Time" over a huge table costs the same
  // as a narrow week: one indexed count per status, not a full-column fetch.
  const STATUS_VALUES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const

  function countQuery(statusValue?: string) {
    let q = supabase.from('bookings').select('*', { count: 'exact', head: true })
    if (range) q = q.gte('service_date', range.start).lte('service_date', range.end)
    if (statusValue) q = q.eq('status', statusValue)
    return q
  }

  const [totalRes, ...statusRes] = await Promise.all([
    countQuery(),
    ...STATUS_VALUES.map((s) => countQuery(s)),
  ])

  const counts: Record<string, number> = {}
  STATUS_VALUES.forEach((s, i) => { counts[s] = statusRes[i].count ?? 0 })
  const periodTotal = totalRes.count ?? 0
  const totalForFilter = status ? (counts[status] ?? 0) : periodTotal

  const page = resolvePage(rawPage, totalForFilter, PAGE_SIZE)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('bookings')
    .select('id, created_at, service_date, service_time, service_name, property_sqm, base_price, status, payment_status, payment_method, address_city, profiles!customer_id (full_name)')
  if (range) query = query.gte('service_date', range.start).lte('service_date', range.end)
  if (status) query = query.eq('status', status)
  switch (sortKey) {
    case 'date_desc':   query = query.order('service_date', { ascending: false }).order('service_time', { ascending: false }); break
    case 'date_asc':    query = query.order('service_date', { ascending: true }).order('service_time', { ascending: true }); break
    case 'booked_asc':  query = query.order('created_at', { ascending: true }); break
    case 'price_desc':  query = query.order('base_price', { ascending: false }); break
    case 'price_asc':   query = query.order('base_price', { ascending: true }); break
    default:             query = query.order('created_at', { ascending: false })
  }
  const { data: bookings } = await query.range(from, to)

  const pageItems = (bookings ?? []) as unknown as Booking[]

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400 mb-1">Admin</p>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`${basePath}/bookings/new`}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 transition-colors shadow-sm"
          >
            + New Booking
          </Link>
          <SortSelect options={SORT_OPTIONS} />
          <p className="text-sm text-gray-400 tabular-nums">{periodTotal} in period</p>
        </div>
      </div>

      {/* Period filter: bounded presets in a dropdown, plus the two open-ended options */}
      <div className="flex flex-wrap items-center gap-2">
        <PeriodSelect options={PERIODS} activeValue={period} defaultValue={DEFAULT_PERIOD} />
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <Link
            href={hrefWith(basePath, current, { period: ALL_TIME.value, start: undefined, end: undefined })}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              period === ALL_TIME.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {ALL_TIME.label}
          </Link>
          <CustomRangeTab
            active={period === 'custom'}
            start={range?.start ?? ''}
            end={range?.end ?? ''}
            path="/bookings"
            extraParams={{ status, sort }}
            allowFuture
          />
        </div>
      </div>
      {range && (
        <p className="text-xs text-gray-400 -mt-4">{rangeSubtitle(range)}</p>
      )}

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTS.map((opt) => {
          const count = opt.value ? (counts[opt.value] ?? 0) : periodTotal
          const isActive = (status ?? '') === opt.value
          const dot = opt.value ? STATUS_META[opt.value]?.dot : undefined
          return (
            <Link
              key={opt.value}
              href={hrefWith(basePath, current, { status: opt.value || undefined })}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isActive
                  ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
              }`}
            >
              {dot && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-white/60' : dot}`} />
              )}
              {opt.label}
              <span className={`tabular-nums ${isActive ? 'text-white/60' : 'text-gray-400'}`}>
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        {pageItems.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">No bookings found</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {status
                  ? `No ${status.replace('_', ' ')} bookings in this period.`
                  : period === 'all'
                    ? 'Bookings will appear here once created.'
                    : 'No bookings in this period — try a different range above.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Column header row */}
            <div className="flex items-center px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
              <span className="flex-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Booking</span>
              <span className="w-24 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-right">Amount</span>
            </div>

            <div className="divide-y divide-gray-100">
              {pageItems.map((b) => {
                const sm = STATUS_META[b.status] ?? { dot: 'bg-gray-400', pill: 'bg-gray-50 text-gray-600 border-gray-200', label: b.status }
                const pm = PAYMENT_STYLES[b.payment_status] ?? 'bg-gray-50 text-gray-500 border-gray-200'
                const serviceLabel = b.service_name ?? '—'
                const serviceImage = getServiceImage(b.service_name)
                return (
                  <Link
                    key={b.id}
                    href={`${basePath}/bookings/${b.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/70 transition-colors group"
                  >
                    {/* Service thumbnail with status dot */}
                    <div className="relative shrink-0">
                      <div className="w-[60px] h-[60px] rounded-xl overflow-hidden shadow-sm bg-pink-50">
                        {serviceImage ? (
                          <Image
                            src={serviceImage}
                            alt={serviceLabel}
                            width={60}
                            height={60}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${sm.dot}`} />
                    </div>

                    {/* Text content — grows, truncates */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 group-hover:text-pink-700 transition-colors truncate">
                          {serviceLabel}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">{b.property_sqm} sqm</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${sm.pill}`}>
                          {sm.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        <span className="font-medium text-gray-700">{b.profiles?.full_name ?? '—'}</span>
                        <span className="mx-1 text-gray-300">·</span>
                        {formatDate(b.service_date)}
                        <span className="mx-1 text-gray-300">·</span>
                        {formatTime(b.service_time)}
                        {b.address_city && (
                          <>
                            <span className="mx-1 text-gray-300">·</span>
                            {b.address_city}
                          </>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                        Booked {formatBookedAt(b.created_at)}
                      </p>
                    </div>

                    {/* Price + payment — fixed width, never shrinks */}
                    <div className="text-right shrink-0 w-24">
                      <p className="text-sm font-bold text-gray-900 tabular-nums">
                        ₱{Number(b.base_price).toLocaleString('en-PH')}
                      </p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold mt-0.5 inline-block ${pm}`}>
                        {paymentStatusLabel(b.payment_status, b.payment_method)}
                      </span>
                      <p className="text-[11px] text-gray-400 mt-0.5 capitalize">{b.payment_method}</p>
                    </div>
                  </Link>
                )
              })}
            </div>

            <Pagination totalItems={totalForFilter} pageSize={PAGE_SIZE} />
          </>
        )}
      </div>
    </div>
  )
}
