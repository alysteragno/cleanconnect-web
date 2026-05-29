import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

type Assignment = {
  id: string
  status: string
  assigned_at: string
  bookings: {
    service_date: string
    service_time: string
    service_type: string
    property_sqm: number
    base_price: number
    status: string
    address_city: string | null
    branches: { name: string } | null
  } | null
}

const SERVICE_LABELS: Record<string, string> = {
  general: 'General Cleaning',
  premium_mattress: 'Mattress & Upholstery',
  complete: 'Complete Package',
  disinfection: 'Disinfection',
  post_construction: 'Post-Construction',
}

const STATUS_BADGE: Record<string, string> = {
  offered: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  accepted: 'bg-blue-50 text-blue-700 border-blue-200',
  declined: 'bg-red-50 text-red-600 border-red-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric',
  })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

export default async function JobsListPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('cleaner_assignments')
    .select('id, status, assigned_at, bookings (service_date, service_time, service_type, property_sqm, base_price, status, address_city, branches (name))')
    .in('status', ['offered', 'accepted'])
    .order('assigned_at', { ascending: false })

  const jobs = (data ?? []) as unknown as Assignment[]

  const offers = jobs.filter((j) => j.status === 'offered')
  const active = jobs.filter((j) => j.status === 'accepted')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/cleaner" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">My Jobs</h1>
      </div>

      {/* Offers */}
      <section className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Offers</h2>
          <span className="text-xs text-gray-400">{offers.length}</span>
        </div>
        {offers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No pending offers.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {offers.map((a) => <JobRow key={a.id} assignment={a} />)}
          </div>
        )}
      </section>

      {/* Active */}
      <section className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Active / Upcoming</h2>
          <span className="text-xs text-gray-400">{active.length}</span>
        </div>
        {active.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No active jobs.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {active.map((a) => <JobRow key={a.id} assignment={a} />)}
          </div>
        )}
      </section>
    </div>
  )
}

function JobRow({ assignment: a }: { assignment: Assignment }) {
  const b = a.bookings
  if (!b) return null
  return (
    <Link
      href={`/cleaner/jobs/${a.id}`}
      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
    >
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-gray-900">
            {SERVICE_LABELS[b.service_type] ?? 'Cleaning'} · {b.property_sqm} sqm
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium capitalize ${STATUS_BADGE[a.status] ?? ''}`}>
            {a.status}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {b.branches?.name} · {formatDate(b.service_date)} at {formatTime(b.service_time)}
          {b.address_city ? ` · ${b.address_city}` : ''}
        </p>
      </div>
      <div className="text-right shrink-0 ml-4">
        <p className="text-sm font-bold text-gray-900">₱{Number(b.base_price).toLocaleString()}</p>
        <p className="text-xs text-blue-600 group-hover:underline mt-0.5">View →</p>
      </div>
    </Link>
  )
}
