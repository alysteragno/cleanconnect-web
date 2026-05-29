import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

type Assignment = {
  id: string
  status: string
  started_at: string | null
  bookings: {
    service_date: string
    service_time: string
    service_type: string
    property_sqm: number
    duration_hours: number
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

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

export default async function SchedulePage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('cleaner_assignments')
    .select('id, status, started_at, bookings (service_date, service_time, service_type, property_sqm, duration_hours, base_price, status, address_city, branches (name))')
    .in('status', ['accepted', 'completed'])
    .order('assigned_at', { ascending: false })

  const all = (data ?? []) as unknown as Assignment[]

  const today = new Date().toISOString().split('T')[0]
  const upcoming = all.filter((a) => a.bookings && a.bookings.service_date >= today && a.status === 'accepted')
  const completed = all.filter((a) => a.status === 'completed')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/cleaner" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Schedule</h1>
      </div>

      <section className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Upcoming</h2>
          <span className="text-xs text-gray-400">{upcoming.length} job{upcoming.length !== 1 ? 's' : ''}</span>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No upcoming jobs.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {upcoming.map((a) => <ScheduleRow key={a.id} a={a} />)}
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Completed</h2>
          <span className="text-xs text-gray-400">{completed.length} job{completed.length !== 1 ? 's' : ''}</span>
        </div>
        {completed.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No completed jobs yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {completed.map((a) => <ScheduleRow key={a.id} a={a} done />)}
          </div>
        )}
      </section>
    </div>
  )
}

function ScheduleRow({ a, done = false }: { a: Assignment; done?: boolean }) {
  const b = a.bookings
  if (!b) return null
  return (
    <Link
      href={`/cleaner/jobs/${a.id}`}
      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors group"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${done ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
        {done ? '✓' : new Date(b.service_date + 'T00:00:00').getDate()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {SERVICE_LABELS[b.service_type] ?? 'Cleaning'} · {b.property_sqm} sqm
        </p>
        <p className="text-xs text-gray-500">
          {formatDate(b.service_date)} at {formatTime(b.service_time)}
          {b.address_city ? ` · ${b.address_city}` : ''}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-gray-900">₱{Number(b.base_price).toLocaleString()}</p>
        <p className="text-xs text-gray-400">{b.duration_hours}h</p>
      </div>
    </Link>
  )
}
