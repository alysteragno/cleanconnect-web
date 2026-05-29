import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

const SERVICE_LABELS: Record<string, string> = {
  general: 'General Cleaning',
  premium_mattress: 'Mattress & Upholstery',
  complete: 'Complete Package',
  disinfection: 'Disinfection',
  post_construction: 'Post-Construction',
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

type Booking = {
  id: string
  service_date: string
  service_time: string
  service_type: string
  property_sqm: number
  base_price: number
  status: string
  profiles: { full_name: string } | null
}

const NAV_CARDS = [
  { href: '/manager/bookings', label: 'Bookings', description: 'All branch bookings', icon: '📋' },
  { href: '/manager/cleaners', label: 'Cleaners', description: 'Branch cleaner roster', icon: '👷' },
]

export default async function ManagerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('branch_id, branches (name, region)')
    .eq('id', user.id)
    .single()

  const p = profile as unknown as { branch_id: string; branches: { name: string; region: string } | null } | null
  const branchName = p?.branches?.name ?? 'Your Branch'

  // Parallel: stats + bookings needing action + recent bookings
  const today = new Date().toISOString().split('T')[0]

  const [
    { count: pendingCount },
    { count: confirmedCount },
    { count: inProgressCount },
    { count: completedTodayCount },
    { data: needsDispatch },
    { data: recent },
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'completed').eq('service_date', today),
    // Pending bookings with NO offered/accepted assignment yet
    supabase
      .from('bookings')
      .select('id, service_date, service_time, service_type, property_sqm, base_price, status, profiles!customer_id (full_name)')
      .eq('status', 'pending')
      .order('service_date', { ascending: true })
      .limit(5),
    supabase
      .from('bookings')
      .select('id, service_date, service_time, service_type, property_sqm, base_price, status, profiles!customer_id (full_name)')
      .in('status', ['confirmed', 'in_progress'])
      .order('service_date', { ascending: true })
      .limit(5),
  ])

  const dispatchList = (needsDispatch ?? []) as unknown as Booking[]
  const recentList = (recent ?? []) as unknown as Booking[]

  const STATS = [
    { label: 'Needs Dispatch', value: pendingCount ?? 0, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
    { label: 'Confirmed', value: confirmedCount ?? 0, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
    { label: 'In Progress', value: inProgressCount ?? 0, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
    { label: 'Done Today', value: completedTodayCount ?? 0, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  ]

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{branchName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Branch Operations Dashboard</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Nav cards */}
      <div className="grid grid-cols-2 gap-4">
        {NAV_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 hover:border-blue-300 hover:bg-blue-50 transition-all"
          >
            <span className="text-2xl shrink-0">{card.icon}</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">{card.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Needs dispatch */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Needs Cleaner Dispatch</h2>
            <p className="text-xs text-gray-400 mt-0.5">Pending bookings awaiting cleaner assignment</p>
          </div>
          <Link href="/manager/bookings?status=pending" className="text-xs text-blue-600 hover:underline font-medium">
            View all
          </Link>
        </div>

        {dispatchList.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No pending bookings.</p>
        ) : (
          <div className="space-y-3">
            {dispatchList.map((b) => (
              <Link
                key={b.id}
                href={`/manager/bookings/${b.id}`}
                className="flex items-center justify-between p-3 border border-yellow-200 bg-yellow-50 rounded-lg hover:border-yellow-400 transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {SERVICE_LABELS[b.service_type] ?? 'Cleaning'} · {b.property_sqm} sqm
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {b.profiles?.full_name ?? 'Customer'} · {formatDate(b.service_date)} at {formatTime(b.service_time)}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-bold text-gray-900">₱{Number(b.base_price).toLocaleString()}</p>
                  <p className="text-xs text-blue-600 group-hover:underline mt-0.5">Dispatch →</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Active jobs */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Active Jobs</h2>
          <Link href="/manager/bookings" className="text-xs text-blue-600 hover:underline font-medium">
            View all
          </Link>
        </div>
        {recentList.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No active jobs.</p>
        ) : (
          <div className="space-y-3">
            {recentList.map((b) => (
              <Link
                key={b.id}
                href={`/manager/bookings/${b.id}`}
                className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-gray-300 transition-colors group"
              >
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-gray-900">
                      {SERVICE_LABELS[b.service_type] ?? 'Cleaning'} · {b.property_sqm} sqm
                    </p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium capitalize ${STATUS_STYLES[b.status] ?? ''}`}>
                      {b.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {b.profiles?.full_name ?? 'Customer'} · {formatDate(b.service_date)} at {formatTime(b.service_time)}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-bold text-gray-900">₱{Number(b.base_price).toLocaleString()}</p>
                  <p className="text-xs text-blue-600 group-hover:underline mt-0.5">View →</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
