import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { PrintButton } from '@/components/ui/print-button'

type CompletedBooking = {
  id: string
  service_date: string
  service_type: string
  property_sqm: number
  base_price: number
  payment_status: string
  payment_method: string
  profiles: { full_name: string } | null
  branches: { name: string } | null
}

type CleanerRow = {
  id: string
  full_name: string
  branches: { name: string } | null
}

const SERVICE_LABELS: Record<string, string> = {
  general:           'General Cleaning',
  premium_mattress:  'Mattress & Upholstery',
  complete:          'Complete Package',
  disinfection:      'Disinfection',
  post_construction: 'Post-Construction',
}

const PAYMENT_STYLES: Record<string, string> = {
  unpaid:   'bg-red-50 text-red-600 border-red-200',
  partial:  'bg-amber-50 text-amber-600 border-amber-200',
  paid:     'bg-emerald-50 text-emerald-600 border-emerald-200',
  refunded: 'bg-gray-50 text-gray-500 border-gray-200',
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function ReportsPage() {
  const supabase = await createClient()

  const [
    { data: completedBookings },
    { data: allBookings },
    { data: cleaners },
    { data: feedbackRows },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, service_date, service_type, property_sqm, base_price, payment_status, payment_method, profiles!customer_id(full_name), branches(name)')
      .eq('status', 'completed')
      .order('service_date', { ascending: false })
      .limit(50),
    supabase.from('bookings').select('status, base_price, payment_status, service_type'),
    supabase
      .from('profiles')
      .select('id, full_name, branches(name)')
      .eq('role', 'cleaner')
      .eq('is_active', true)
      .order('full_name'),
    supabase.from('feedback').select('cleaner_id, rating'),
  ])

  const completed  = (completedBookings ?? []) as unknown as CompletedBooking[]
  const all        = (allBookings ?? []) as { status: string; base_price: number; payment_status: string; service_type: string }[]
  const cleanerList= (cleaners ?? []) as unknown as CleanerRow[]
  const feedback   = (feedbackRows ?? []) as { cleaner_id: string; rating: number }[]

  // Financial
  const totalRevenue    = all.filter((b) => b.payment_status === 'paid').reduce((s, b) => s + Number(b.base_price), 0)
  const partialRevenue  = all.filter((b) => b.payment_status === 'partial').reduce((s, b) => s + Number(b.base_price), 0)
  const unpaidRevenue   = all.filter((b) => b.payment_status === 'unpaid').reduce((s, b) => s + Number(b.base_price), 0)
  const totalPotential  = all.reduce((s, b) => s + Number(b.base_price), 0)
  const collectionRate  = totalPotential > 0 ? Math.round((totalRevenue / totalPotential) * 100) : 0

  // Status breakdown
  const statusCounts = all.reduce((acc, b) => { acc[b.status] = (acc[b.status] ?? 0) + 1; return acc }, {} as Record<string, number>)
  const statusOrder  = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']

  // Service breakdown
  const serviceCounts = all.reduce((acc, b) => { acc[b.service_type] = (acc[b.service_type] ?? 0) + 1; return acc }, {} as Record<string, number>)

  // Cleaner performance
  const cleanerStats = await Promise.all(
    cleanerList.map(async (c) => {
      const { count } = await supabase
        .from('cleaner_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('cleaner_id', c.id)
        .eq('status', 'completed')
      const myFeedback = feedback.filter((f) => f.cleaner_id === c.id)
      const avgRating  = myFeedback.length > 0
        ? myFeedback.reduce((s, f) => s + f.rating, 0) / myFeedback.length
        : null
      return { ...c, jobs: count ?? 0, avgRating, reviews: myFeedback.length }
    })
  )

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight mt-2">Reports & Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Bookings, revenue, and cleaner performance data</p>
        </div>
        <PrintButton />
      </div>

      {/* Revenue KPIs */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Financial Summary</h2>
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
            <p className="text-xs text-gray-500 mt-1">Outstanding (Unpaid)</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-pink-500 px-5 py-4">
            <p className="text-2xl font-bold text-pink-600">{collectionRate}%</p>
            <p className="text-xs text-gray-500 mt-1">Collection Rate</p>
          </div>
        </div>

        {/* Revenue breakdown bar */}
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
              {partialRevenue > 0 && (
                <div
                  className="bg-amber-400 h-full transition-all"
                  style={{ width: `${(partialRevenue / totalPotential) * 100}%` }}
                  title={`Partial: ₱${partialRevenue.toLocaleString()}`}
                />
              )}
              {unpaidRevenue > 0 && (
                <div
                  className="bg-red-300 h-full transition-all"
                  style={{ width: `${(unpaidRevenue / totalPotential) * 100}%` }}
                  title={`Unpaid: ₱${unpaidRevenue.toLocaleString()}`}
                />
              )}
            </div>
            <div className="flex gap-4 mt-3">
              {[
                { label: 'Paid',    color: 'bg-emerald-400', value: `₱${totalRevenue.toLocaleString()}` },
                { label: 'Partial', color: 'bg-amber-400',   value: `₱${partialRevenue.toLocaleString()}` },
                { label: 'Unpaid',  color: 'bg-red-300',     value: `₱${unpaidRevenue.toLocaleString()}` },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${l.color} shrink-0`} />
                  <span className="text-xs text-gray-500">{l.label}: <strong className="text-gray-700">{l.value}</strong></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Booking analytics */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Booking Analytics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Status distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">By Status</p>
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
          </div>

          {/* Service type distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">By Service Type</p>
            <div className="space-y-2.5">
              {Object.entries(serviceCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const pct = all.length > 0 ? (count / all.length) * 100 : 0
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <p className="text-xs text-gray-600 w-36 shrink-0 truncate">{SERVICE_LABELS[type] ?? type}</p>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="bg-pink-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs font-semibold text-gray-700 w-6 text-right">{count}</p>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      </section>

      {/* Cleaner performance */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Cleaner Performance</h2>
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="hidden sm:grid grid-cols-[1fr_160px_100px_100px_80px] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50/60 rounded-t-xl">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Cleaner</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Branch</p>
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
                  className="flex sm:grid sm:grid-cols-[1fr_160px_100px_100px_80px] gap-3 sm:gap-4 items-center px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                      {c.full_name.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-sm font-medium text-gray-900 group-hover:text-pink-700 transition-colors truncate">
                      {c.full_name}
                    </p>
                  </div>
                  <p className="hidden sm:block text-xs text-gray-500">{c.branches?.name ?? '—'}</p>
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
                  {/* Mobile compact */}
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

      {/* Service history table */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
          Service History
          <span className="text-gray-400 font-normal ml-2 normal-case">(last 50 completed)</span>
        </h2>
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="hidden sm:grid grid-cols-[100px_1fr_160px_1fr_100px_80px] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50/60 rounded-t-xl">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Service</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Branch</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Amount</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Payment</p>
          </div>
          {completed.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No completed bookings yet.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {completed.map((b) => (
                <div
                  key={b.id}
                  className="hidden sm:grid grid-cols-[100px_1fr_160px_1fr_100px_80px] gap-4 items-center px-5 py-3.5"
                >
                  <p className="text-xs text-gray-600">{formatDate(b.service_date)}</p>
                  <p className="text-sm text-gray-800 truncate">{SERVICE_LABELS[b.service_type] ?? b.service_type}</p>
                  <p className="text-xs text-gray-500 truncate">{b.branches?.name ?? '—'}</p>
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
          )}
          {/* Mobile fallback */}
          <div className="sm:hidden divide-y divide-gray-50">
            {completed.map((b) => (
              <div key={b.id + '-m'} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{b.profiles?.full_name ?? '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{SERVICE_LABELS[b.service_type] ?? b.service_type} · {formatDate(b.service_date)}</p>
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
        </div>
      </section>
    </div>
  )
}
