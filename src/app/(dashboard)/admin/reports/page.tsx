import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'

type CompletedBooking = {
  id: string
  service_date: string
  service_name: string | null
  space_type: string
  property_sqm: number
  base_price: number
  payment_status: string
  payment_method: string
  profiles: { full_name: string } | null
}

type SpaceTypeStat = {
  label: string
  count: number
  revenue: number
  avgSqm: number | null
  paidRevenue: number
}

type CleanerRow = { id: string; full_name: string; photo_url: string | null }

type RecentFeedback = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  bookings: { service_name: string | null } | null
  profiles: { full_name: string } | null
}

type WeekBooking = {
  id: string
  service_date: string
  service_time: string
  service_name: string | null
  status: string
  base_price: number
  profiles: { full_name: string } | null
}

const SPACE_LABELS: Record<string, string> = {
  residential: 'Residential (House)',
  condo:       'Condo Unit',
  office:      'Office',
  commercial:  'Commercial Space',
}

const SPACE_COLORS: Record<string, string> = {
  residential: 'bg-blue-400',
  condo:       'bg-violet-400',
  office:      'bg-amber-400',
  commercial:  'bg-emerald-400',
}

const SPACE_BADGE: Record<string, string> = {
  residential: 'bg-blue-50 text-blue-700 border-blue-200',
  condo:       'bg-violet-50 text-violet-700 border-violet-200',
  office:      'bg-amber-50 text-amber-700 border-amber-200',
  commercial:  'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const COMMERCIAL_TYPES = new Set(['condo', 'office', 'commercial'])

const PAYMENT_STYLES: Record<string, string> = {
  unpaid:   'bg-red-50 text-red-600 border-red-200',
  paid:     'bg-emerald-50 text-emerald-600 border-emerald-200',
  refunded: 'bg-gray-50 text-gray-500 border-gray-200',
}

const PERIODS = [
  { value: 'day',   label: 'Today'      },
  { value: 'week',  label: 'This Week'  },
  { value: 'month', label: 'This Month' },
  { value: 'all',   label: 'All Time'   },
] as const
type Period = (typeof PERIODS)[number]['value']

type DateRange = { start: string; end: string }

function getDateRange(period: string): DateRange | null {
  // Always derive dates in Philippines time (UTC+8)
  const phToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) // 'YYYY-MM-DD'
  const [y, mo, d] = phToday.split('-').map(Number) // mo is 1-indexed
  const pad = (n: number) => String(n).padStart(2, '0')

  if (period === 'day') {
    return { start: phToday, end: phToday }
  }
  if (period === 'week') {
    const noonPH = new Date(`${phToday}T12:00:00+08:00`)
    const dow = noonPH.getDay() // 0=Sun
    const diffToMon = dow === 0 ? -6 : 1 - dow
    const mon = new Date(noonPH); mon.setDate(noonPH.getDate() + diffToMon)
    const sun = new Date(mon);    sun.setDate(mon.getDate() + 6)
    return {
      start: mon.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
      end:   sun.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
    }
  }
  if (period === 'month') {
    const lastDay = new Date(y, mo, 0).getDate() // mo is 1-indexed so this gives last day of that month
    return { start: `${y}-${pad(mo)}-01`, end: `${y}-${pad(mo)}-${pad(lastDay)}` }
  }
  return null
}

function periodSubtitle(period: string, range: DateRange | null): string {
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${d}T12:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', ...opts })
  if (period === 'day' && range)
    return fmt(range.start, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  if (period === 'week' && range)
    return `${fmt(range.start, { month: 'short', day: 'numeric' })} – ${fmt(range.end, { month: 'short', day: 'numeric', year: 'numeric' })}`
  if (period === 'month')
    return new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'long', year: 'numeric' })
  return 'All time'
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: rawPeriod = 'month' } = await searchParams
  const period: Period = PERIODS.some((p) => p.value === rawPeriod)
    ? (rawPeriod as Period)
    : 'month'

  const range    = getDateRange(period)
  const subtitle = periodSubtitle(period, range)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: authProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (authProfile?.role !== 'super_admin') notFound()

  const adminDb = createAdminClient()
  const now = new Date()

  // Weekly schedule always shows current week in Philippines time
  const phToday = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const noonPH  = new Date(`${phToday}T12:00:00+08:00`)
  const curDow  = noonPH.getDay()
  const monPH   = new Date(noonPH); monPH.setDate(noonPH.getDate() + (curDow === 0 ? -6 : 1 - curDow))
  const sunPH   = new Date(monPH);  sunPH.setDate(monPH.getDate() + 6)
  const weekStart = monPH.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const weekEnd   = sunPH.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

  // Period-filtered queries — filter by created_at (Philippines time) so bookings appear in the period they were made
  const allBookingsQ = range
    ? adminDb.from('bookings').select('status, base_price, payment_status, service_name, space_type, property_sqm')
        .gte('created_at', `${range.start}T00:00:00+08:00`).lte('created_at', `${range.end}T23:59:59+08:00`)
    : adminDb.from('bookings').select('status, base_price, payment_status, service_name, space_type, property_sqm')

  const completedQ = range
    ? adminDb.from('bookings')
        .select('id, service_date, service_name, property_sqm, base_price, payment_status, payment_method, profiles!customer_id(full_name)')
        .eq('status', 'completed')
        .gte('created_at', `${range.start}T00:00:00+08:00`).lte('created_at', `${range.end}T23:59:59+08:00`)
        .order('service_date', { ascending: false })
    : adminDb.from('bookings')
        .select('id, service_date, service_name, property_sqm, base_price, payment_status, payment_method, profiles!customer_id(full_name)')
        .eq('status', 'completed')
        .order('service_date', { ascending: false })
        .limit(100)

  // Period-filtered recent feedback (by created_at)
  const recentFeedbackQ = range
    ? adminDb.from('feedback')
        .select('id, rating, comment, created_at, bookings(service_name), profiles!customer_id(full_name)')
        .gte('created_at', `${range.start}T00:00:00+08:00`)
        .lte('created_at', `${range.end}T23:59:59+08:00`)
        .order('created_at', { ascending: false })
        .limit(5)
    : adminDb.from('feedback')
        .select('id, rating, comment, created_at, bookings(service_name), profiles!customer_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(5)

  const [
    { data: allBookings },
    { data: completedBookings },
    { data: cleaners },
    { data: feedbackRows },
    { data: weekBookings },
    { data: recentFeedbackRows },
  ] = await Promise.all([
    allBookingsQ,
    completedQ,
    adminDb.from('profiles').select('id, full_name, photo_url').eq('role', 'cleaner').eq('is_active', true).order('full_name'),
    adminDb.from('feedback').select('cleaner_id, rating'),
    adminDb.from('bookings')
      .select('id, service_date, service_time, service_name, status, base_price, profiles!customer_id(full_name)')
      .gte('service_date', weekStart).lte('service_date', weekEnd)
      .not('status', 'eq', 'cancelled')
      .order('service_date').order('service_time'),
    recentFeedbackQ,
  ])

  const all           = (allBookings ?? []) as { status: string; base_price: number; payment_status: string; service_name: string | null; space_type: string; property_sqm: number }[]
  const completed     = (completedBookings ?? []) as unknown as CompletedBooking[]
  const cleanerList   = (cleaners ?? []) as unknown as CleanerRow[]
  const feedback      = (feedbackRows ?? []) as { cleaner_id: string; rating: number }[]
  const weekList      = (weekBookings ?? []) as unknown as WeekBooking[]
  const recentFeedback = (recentFeedbackRows ?? []) as unknown as RecentFeedback[]

  // Feedback stats (all-time — used for avg + distribution)
  const allRatings   = feedback.map((f) => f.rating)
  const feedbackAvg  = allRatings.length > 0
    ? (allRatings.reduce((s, r) => s + r, 0) / allRatings.length).toFixed(1)
    : null
  const ratingDist   = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: allRatings.filter((r) => r === star).length,
  }))

  // Weekly schedule: group by date
  const weekByDay = weekList.reduce<Record<string, WeekBooking[]>>((acc, b) => {
    ;(acc[b.service_date] ??= []).push(b)
    return acc
  }, {})
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monPH)
    d.setDate(monPH.getDate() + i)
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  })

  // Financial KPIs
  const totalRevenue   = all.filter((b) => b.payment_status === 'paid').reduce((s, b) => s + Number(b.base_price), 0)
  const unpaidRevenue  = all.filter((b) => b.payment_status === 'unpaid').reduce((s, b) => s + Number(b.base_price), 0)
  const totalPotential = all.reduce((s, b) => s + Number(b.base_price), 0)
  const collectionRate = totalPotential > 0 ? Math.round((totalRevenue / totalPotential) * 100) : 0

  // Status + service breakdown
  const statusCounts  = all.reduce((acc, b) => { acc[b.status] = (acc[b.status] ?? 0) + 1; return acc }, {} as Record<string, number>)
  const serviceCounts = all.reduce((acc, b) => { const k = b.service_name ?? 'Unknown'; acc[k] = (acc[k] ?? 0) + 1; return acc }, {} as Record<string, number>)
  const statusOrder   = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']

  // Property type analysis
  const spaceTypeMap = all.reduce<Record<string, { count: number; totalRevenue: number; paidRevenue: number; sqmSum: number; sqmCount: number }>>(
    (acc, b) => {
      const key = b.space_type || 'residential'
      if (!acc[key]) acc[key] = { count: 0, totalRevenue: 0, paidRevenue: 0, sqmSum: 0, sqmCount: 0 }
      acc[key].count++
      acc[key].totalRevenue += Number(b.base_price)
      if (b.payment_status === 'paid') acc[key].paidRevenue += Number(b.base_price)
      if (b.property_sqm > 0) { acc[key].sqmSum += Number(b.property_sqm); acc[key].sqmCount++ }
      return acc
    },
    {}
  )
  const spaceTypeOrder = ['residential', 'condo', 'office', 'commercial']
  const spaceTypeStats: SpaceTypeStat[] = spaceTypeOrder
    .filter((k) => spaceTypeMap[k])
    .map((k) => ({
      label:       SPACE_LABELS[k] ?? k,
      count:       spaceTypeMap[k].count,
      revenue:     spaceTypeMap[k].totalRevenue,
      paidRevenue: spaceTypeMap[k].paidRevenue,
      avgSqm:      spaceTypeMap[k].sqmCount > 0 ? Math.round(spaceTypeMap[k].sqmSum / spaceTypeMap[k].sqmCount) : null,
    }))
  const unknownTypes = Object.keys(spaceTypeMap).filter((k) => !spaceTypeOrder.includes(k))
  unknownTypes.forEach((k) => {
    spaceTypeStats.push({
      label:       k.charAt(0).toUpperCase() + k.slice(1),
      count:       spaceTypeMap[k].count,
      revenue:     spaceTypeMap[k].totalRevenue,
      paidRevenue: spaceTypeMap[k].paidRevenue,
      avgSqm:      spaceTypeMap[k].sqmCount > 0 ? Math.round(spaceTypeMap[k].sqmSum / spaceTypeMap[k].sqmCount) : null,
    })
  })
  const commercialCount     = all.filter((b) => COMMERCIAL_TYPES.has(b.space_type || '')).length
  const residentialCount    = all.filter((b) => !COMMERCIAL_TYPES.has(b.space_type || '')).length
  const commercialRevenue   = all.filter((b) => COMMERCIAL_TYPES.has(b.space_type || '') && b.payment_status === 'paid').reduce((s, b) => s + Number(b.base_price), 0)
  const residentialRevenue  = all.filter((b) => !COMMERCIAL_TYPES.has(b.space_type || '') && b.payment_status === 'paid').reduce((s, b) => s + Number(b.base_price), 0)

  // Cleaner performance (always all-time)
  const cleanerStats = await Promise.all(
    cleanerList.map(async (c) => {
      const { count } = await adminDb
        .from('cleaner_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('cleaner_id', c.id).eq('status', 'completed')
      const myFeedback = feedback.filter((f) => f.cleaner_id === c.id)
      const avgRating  = myFeedback.length > 0
        ? myFeedback.reduce((s, f) => s + f.rating, 0) / myFeedback.length
        : null
      return { ...c, jobs: count ?? 0, avgRating, reviews: myFeedback.length }
    })
  )

  const topCleaners = cleanerStats
    .filter((c) => c.avgRating != null && c.avgRating >= 4.5)
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight mt-2">Reports & Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Bookings, revenue, and cleaner performance</p>
        </div>
      </div>

      {/* Period tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {PERIODS.map((p) => (
          <Link
            key={p.value}
            href={`/admin/reports?period=${p.value}`}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              period === p.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* Financial Summary */}
      <section>
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Financial Summary</h2>
          <span className="text-xs text-gray-400">{subtitle}</span>
        </div>

        {all.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-10 text-center">
            <p className="text-sm text-gray-400">No bookings for this period.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-gray-300 px-5 py-4">
                <p className="text-2xl font-bold text-gray-900">{all.length}</p>
                <p className="text-xs text-gray-500 mt-1">Total Bookings</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-emerald-400 px-5 py-4">
                <p className="text-2xl font-bold text-emerald-600">₱{totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Revenue Collected</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-red-400 px-5 py-4">
                <p className="text-2xl font-bold text-red-600">₱{unpaidRevenue.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Outstanding (Processing Payment)</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-pink-500 px-5 py-4">
                <p className="text-2xl font-bold text-pink-600">{collectionRate}%</p>
                <p className="text-xs text-gray-500 mt-1">Collection Rate</p>
              </div>
            </div>

            {totalPotential > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Revenue Breakdown</p>
                  <p className="text-xs text-gray-400">Total potential: ₱{totalPotential.toLocaleString()}</p>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 gap-px">
                  {totalRevenue > 0 && (
                    <div
                      className="bg-emerald-400 h-full transition-all"
                      style={{ width: `${(totalRevenue / totalPotential) * 100}%` }}
                      title={`Paid: ₱${totalRevenue.toLocaleString()}`}
                    />
                  )}
                  {unpaidRevenue > 0 && (
                    <div
                      className="bg-red-300 h-full transition-all"
                      style={{ width: `${(unpaidRevenue / totalPotential) * 100}%` }}
                      title={`Processing Payment: ₱${unpaidRevenue.toLocaleString()}`}
                    />
                  )}
                </div>
                <div className="flex gap-4 mt-3">
                  {[
                    { label: 'Paid',   color: 'bg-emerald-400', value: `₱${totalRevenue.toLocaleString()}`  },
                    { label: 'Processing Payment', color: 'bg-red-300', value: `₱${unpaidRevenue.toLocaleString()}` },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${l.color} shrink-0`} />
                      <span className="text-xs text-gray-500">{l.label}: <strong className="text-gray-700">{l.value}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Booking Analytics */}
      <section>
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Booking Analytics</h2>
          <span className="text-xs text-gray-400">{subtitle}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* By status */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">By Status</p>
            {all.length === 0 ? (
              <p className="text-xs text-gray-400">No data.</p>
            ) : (
              <div className="space-y-2.5">
                {statusOrder.filter((s) => statusCounts[s]).map((s) => {
                  const count = statusCounts[s] ?? 0
                  const pct   = all.length > 0 ? (count / all.length) * 100 : 0
                  const barColor: Record<string, string> = {
                    pending:     'bg-amber-400',
                    confirmed:   'bg-pink-400',
                    in_progress: 'bg-violet-400',
                    completed:   'bg-emerald-400',
                    cancelled:   'bg-red-300',
                  }
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <p className="text-xs text-gray-600 capitalize w-24 shrink-0">{s.replace('_', ' ')}</p>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className={`${barColor[s] ?? 'bg-gray-300'} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs font-semibold text-gray-700 w-6 text-right">{count}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* By service type */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">By Service Type</p>
            {all.length === 0 ? (
              <p className="text-xs text-gray-400">No data.</p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(serviceCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => {
                    const pct = all.length > 0 ? (count / all.length) * 100 : 0
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <p className="text-xs text-gray-600 w-36 shrink-0 truncate">{type}</p>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="bg-pink-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs font-semibold text-gray-700 w-6 text-right">{count}</p>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Property Type Analysis */}
      <section>
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Property Type Analysis</h2>
          <span className="text-xs text-gray-400">{subtitle}</span>
        </div>

        {all.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-10 text-center">
            <p className="text-sm text-gray-400">No bookings for this period.</p>
          </div>
        ) : (
          <div className="space-y-4">

            {/* Residential vs Commercial summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-blue-400 px-5 py-4">
                <p className="text-2xl font-bold text-gray-900">{residentialCount}</p>
                <p className="text-xs text-gray-500 mt-1">Residential Bookings</p>
                <p className="text-xs text-emerald-600 font-medium mt-2">₱{residentialRevenue.toLocaleString()} collected</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-violet-400 px-5 py-4">
                <p className="text-2xl font-bold text-gray-900">{commercialCount}</p>
                <p className="text-xs text-gray-500 mt-1">Commercial Bookings</p>
                <p className="text-xs text-emerald-600 font-medium mt-2">₱{commercialRevenue.toLocaleString()} collected</p>
              </div>
            </div>

            {/* Per-type breakdown */}
            {spaceTypeStats.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="hidden sm:grid grid-cols-[1fr_80px_120px_120px_100px] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Space Type</p>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Bookings</p>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Total Value</p>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Collected</p>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Avg Size</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {spaceTypeStats.map((s) => {
                    const key = Object.entries(SPACE_LABELS).find(([, v]) => v === s.label)?.[0] ?? 'residential'
                    const barPct = all.length > 0 ? (s.count / all.length) * 100 : 0
                    return (
                      <div key={s.label} className="px-5 py-4">
                        {/* Desktop */}
                        <div className="hidden sm:grid grid-cols-[1fr_80px_120px_120px_100px] gap-4 items-center">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SPACE_BADGE[key] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                              {s.label}
                            </span>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-gray-800">{s.count}</p>
                            <div className="mt-1 bg-gray-100 rounded-full h-1.5">
                              <div className={`${SPACE_COLORS[key] ?? 'bg-gray-400'} h-1.5 rounded-full`} style={{ width: `${barPct}%` }} />
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-gray-800 text-right">₱{s.revenue.toLocaleString()}</p>
                          <p className="text-sm font-semibold text-emerald-600 text-right">₱{s.paidRevenue.toLocaleString()}</p>
                          <p className="text-sm text-gray-600 text-right">{s.avgSqm != null ? `${s.avgSqm} sqm` : '—'}</p>
                        </div>
                        {/* Mobile */}
                        <div className="sm:hidden">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SPACE_BADGE[key] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                              {s.label}
                            </span>
                            <span className="text-xs font-semibold text-gray-700">{s.count} booking{s.count !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="bg-gray-100 rounded-full h-1.5 mb-2">
                            <div className={`${SPACE_COLORS[key] ?? 'bg-gray-400'} h-1.5 rounded-full`} style={{ width: `${barPct}%` }} />
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Value: <strong className="text-gray-800">₱{s.revenue.toLocaleString()}</strong></span>
                            <span>Paid: <strong className="text-emerald-600">₱{s.paidRevenue.toLocaleString()}</strong></span>
                            {s.avgSqm != null && <span>Avg: <strong className="text-gray-800">{s.avgSqm} sqm</strong></span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Stacked bar: share of total bookings */}
                {spaceTypeStats.length > 1 && (
                  <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/60">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Booking Share</p>
                    <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 gap-px">
                      {spaceTypeStats.map((s) => {
                        const key = Object.entries(SPACE_LABELS).find(([, v]) => v === s.label)?.[0] ?? 'residential'
                        const pct = all.length > 0 ? (s.count / all.length) * 100 : 0
                        return pct > 0 ? (
                          <div
                            key={s.label}
                            className={`${SPACE_COLORS[key] ?? 'bg-gray-400'} h-full transition-all`}
                            style={{ width: `${pct}%` }}
                            title={`${s.label}: ${s.count} (${Math.round(pct)}%)`}
                          />
                        ) : null
                      })}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                      {spaceTypeStats.map((s) => {
                        const key = Object.entries(SPACE_LABELS).find(([, v]) => v === s.label)?.[0] ?? 'residential'
                        const pct = all.length > 0 ? Math.round((s.count / all.length) * 100) : 0
                        return (
                          <div key={s.label} className="flex items-center gap-1.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${SPACE_COLORS[key] ?? 'bg-gray-400'} shrink-0`} />
                            <span className="text-xs text-gray-500">{s.label}: <strong className="text-gray-700">{pct}%</strong></span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Cleaner Performance — always all-time */}
      <section>
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Cleaner Performance</h2>
          <span className="text-xs text-gray-400">All time</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="hidden sm:grid grid-cols-[1fr_100px_100px_80px] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50/60 rounded-t-xl">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Cleaner</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Jobs Done</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Avg Rating</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Reviews</p>
          </div>
          {cleanerStats.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No active cleaners.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {cleanerStats.sort((a, b) => b.jobs - a.jobs).map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/cleaners/${c.id}`}
                  className="flex sm:grid sm:grid-cols-[1fr_100px_100px_80px] gap-3 sm:gap-4 items-center px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {c.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.photo_url}
                        alt={c.full_name}
                        className="w-8 h-8 rounded-full object-cover border border-gray-200 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                        {c.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <p className="text-sm font-medium text-gray-900 group-hover:text-pink-700 transition-colors truncate">
                      {c.full_name}
                    </p>
                  </div>
                  <p className="hidden sm:block text-sm font-semibold text-gray-800 text-center">{c.jobs}</p>
                  <div className="hidden sm:flex items-center justify-center gap-1">
                    {c.avgRating != null ? (
                      <>
                        <span className="text-yellow-400 text-sm">★</span>
                        <span className="text-sm font-semibold text-gray-800">{c.avgRating.toFixed(1)}</span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">No data</span>
                    )}
                  </div>
                  <p className="hidden sm:block text-xs text-gray-500 text-right">{c.reviews}</p>
                  <div className="sm:hidden flex items-center gap-2 ml-auto shrink-0">
                    <span className="text-xs text-gray-500">{c.jobs} jobs</span>
                    {c.avgRating != null && (
                      <span className="text-xs text-yellow-500">★{c.avgRating.toFixed(1)}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Top Cleaners Leaderboard — always all-time */}
      <section>
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Top Cleaners</h2>
          <span className="text-xs text-gray-400">4.5★ and above · All time</span>
        </div>
        {topCleaners.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-10 text-center">
            <p className="text-sm text-gray-400">No cleaners with 4.5★ or higher yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {topCleaners.map((c, i) => (
              <Link
                key={c.id}
                href={`/admin/cleaners/${c.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-amber-50/40 transition-colors group"
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i === 0 ? 'bg-amber-400 text-white' :
                  i === 1 ? 'bg-gray-300 text-gray-700' :
                  i === 2 ? 'bg-amber-700/70 text-white' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-amber-700 transition-colors truncate">{c.full_name}</p>
                  <p className="text-xs text-gray-400">{c.jobs} jobs · {c.reviews} review{c.reviews !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-amber-400">★</span>
                  <span className="text-sm font-bold text-gray-900">{c.avgRating!.toFixed(1)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Customer Feedback Summary */}
      <section>
        <div className="flex items-baseline justify-between gap-2 mb-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Customer Feedback</h2>
            <span className="text-xs text-gray-400">
              {period === 'all' ? 'Recent reviews' : `Reviews · ${subtitle}`}
            </span>
          </div>
          <Link href="/admin/feedback" className="text-xs text-pink-600 hover:text-pink-800 transition-colors">
            See all →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Overall rating + distribution — always all-time */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-3xl font-bold text-gray-900">{feedbackAvg ?? '—'}</p>
                <p className="text-xs text-gray-400 mt-0.5">Overall avg · {allRatings.length} reviews</p>
              </div>
              <div className="flex gap-0.5 text-2xl ml-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={Number(feedbackAvg) >= i ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {ratingDist.map(({ star, count }) => {
                const pct = allRatings.length > 0 ? (count / allRatings.length) * 100 : 0
                return (
                  <div key={star} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-8 shrink-0">{star} ★</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-5 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent reviews */}
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {recentFeedback.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No reviews for this period.</p>
            ) : (
              recentFeedback.map((f) => (
                <div key={f.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span key={i} className={`text-sm ${f.rating >= i ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                      ))}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(f.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {f.profiles?.full_name ?? 'Customer'} · {f.bookings?.service_name ?? 'Service'}
                  </p>
                  {f.comment && (
                    <p className="text-xs text-gray-700 italic mt-1 line-clamp-2">&ldquo;{f.comment}&rdquo;</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Weekly Schedule — always current week */}
      <section>
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">This Week&apos;s Schedule</h2>
          <span className="text-xs text-gray-400">
            {new Date(weekStart + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            {' – '}
            {new Date(weekEnd + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <div className="space-y-3">
          {weekDays.map((date) => {
            const dayBookings = weekByDay[date] ?? []
            const label   = new Date(date + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' })
            const isToday = date === now.toISOString().split('T')[0]
            return (
              <div key={date} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className={`px-5 py-2.5 border-b border-gray-100 flex items-center justify-between ${isToday ? 'bg-pink-50' : 'bg-gray-50/60'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-pink-700' : 'text-gray-500'}`}>
                    {label}{isToday && <span className="ml-2 text-pink-500">Today</span>}
                  </p>
                  <span className="text-xs text-gray-400">{dayBookings.length} booking{dayBookings.length !== 1 ? 's' : ''}</span>
                </div>
                {dayBookings.length === 0 ? (
                  <p className="text-xs text-gray-300 px-5 py-3">No bookings</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {dayBookings.map((b) => (
                      <Link
                        key={b.id}
                        href={`/admin/bookings/${b.id}`}
                        className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors group"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 group-hover:text-pink-700 transition-colors">
                            {b.service_name ?? 'Cleaning'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatTime(b.service_time)} · {b.profiles?.full_name ?? 'Customer'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <p className="text-sm font-semibold text-gray-900">₱{Number(b.base_price).toLocaleString()}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${
                            b.status === 'confirmed'   ? 'bg-pink-50 text-pink-700 border-pink-200' :
                            b.status === 'in_progress' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            b.status === 'pending'     ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                            'bg-gray-50 text-gray-500 border-gray-200'
                          }`}>
                            {b.status.replace('_', ' ')}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Service History */}
      <section>
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Service History</h2>
          <span className="text-xs text-gray-400">
            {period === 'all' ? 'Last 100 completed' : `Completed · ${subtitle}`}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="hidden sm:grid grid-cols-[100px_1fr_1fr_100px_80px] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50/60 rounded-t-xl">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Service</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Amount</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Payment</p>
          </div>
          {completed.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No completed bookings for this period.</p>
          ) : (
            <>
              <div className="divide-y divide-gray-50">
                {completed.map((b) => (
                  <div
                    key={b.id}
                    className="hidden sm:grid grid-cols-[100px_1fr_1fr_100px_80px] gap-4 items-center px-5 py-3.5"
                  >
                    <p className="text-xs text-gray-600">{formatDate(b.service_date)}</p>
                    <p className="text-sm text-gray-800 truncate">{b.service_name ?? '—'}</p>
                    <p className="text-sm text-gray-700 truncate">{b.profiles?.full_name ?? '—'}</p>
                    <p className="text-sm font-semibold text-gray-900 text-right">₱{Number(b.base_price).toLocaleString()}</p>
                    <div className="flex justify-end">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${PAYMENT_STYLES[b.payment_status] ?? ''}`}>
                        {b.payment_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Mobile */}
              <div className="sm:hidden divide-y divide-gray-50">
                {completed.map((b) => (
                  <div key={b.id + '-m'} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{b.profiles?.full_name ?? '—'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{b.service_name ?? '—'} · {formatDate(b.service_date)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <p className="text-sm font-bold text-gray-900">₱{Number(b.base_price).toLocaleString()}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${PAYMENT_STYLES[b.payment_status] ?? ''}`}>
                          {b.payment_status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
