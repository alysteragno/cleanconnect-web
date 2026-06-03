import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { BranchFilter } from './branch-filter'

type Booking = {
  id: string
  service_date: string
  service_time: string
  service_type: string
  property_sqm: number
  base_price: number
  status: string
  payment_status: string
  profiles: { full_name: string } | null
  branches: { name: string } | null
}

type Branch = { id: string; name: string }

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-pink-50 text-pink-700 border-pink-200',
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
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; branch?: string }>
}) {
  const { status, branch } = await searchParams
  const supabase = await createClient()

  const [{ data: branches }, { data: bookings }] = await Promise.all([
    supabase.from('branches').select('id, name').order('name'),
    (() => {
      let q = supabase
        .from('bookings')
        .select('id, service_date, service_time, service_type, property_sqm, base_price, status, payment_status, profiles!customer_id (full_name), branches (name)')
        .order('service_date', { ascending: false })
      if (status) q = q.eq('status', status)
      if (branch) q = q.eq('branch_id', branch)
      return q
    })(),
  ])

  const list = (bookings ?? []) as unknown as Booking[]
  const branchList = (branches ?? []) as Branch[]

  function filterLink(key: string, value: string | undefined) {
    const params = new URLSearchParams()
    if (status && key !== 'status') params.set('status', status)
    if (branch && key !== 'branch') params.set('branch', branch)
    if (value) params.set(key, value)
    const q = params.toString()
    return `/admin/bookings${q ? '?' + q : ''}`
  }

  const STATUS_OPTS = ['', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled']

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Dashboard</Link>
        <div className="flex items-baseline justify-between mt-2">
          <h1 className="text-xl font-bold text-gray-900">All Bookings</h1>
          <span className="text-sm text-gray-400">{list.length} results</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTS.map((s) => (
            <Link
              key={s}
              href={filterLink('status', s || undefined)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors capitalize ${
                (status ?? '') === s
                  ? 'bg-pink-600 text-white border-pink-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {s === '' ? 'All' : s.replace('_', ' ')}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {list.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">No bookings found.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.map((b) => (
              <Link
                key={b.id}
                href={`/admin/bookings/${b.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-medium text-gray-900">
                      {SERVICE_LABELS[b.service_type] ?? 'Cleaning'} · {b.property_sqm} sqm
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_STYLES[b.status] ?? ''}`}>
                      {b.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {b.branches?.name ?? '—'} · {b.profiles?.full_name ?? 'Customer'} · {formatDate(b.service_date)} at {formatTime(b.service_time)}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-bold text-gray-900">₱{Number(b.base_price).toLocaleString()}</p>
                  <p className="text-xs text-gray-400 capitalize mt-0.5 group-hover:text-pink-600 transition-colors">
                    {b.payment_status} →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
