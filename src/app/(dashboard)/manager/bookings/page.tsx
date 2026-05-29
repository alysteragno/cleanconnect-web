import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

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
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const SERVICE_LABELS: Record<string, string> = {
  general: 'General Cleaning',
  premium_mattress: 'Mattress & Upholstery',
  complete: 'Complete Package',
  disinfection: 'Disinfection',
  post_construction: 'Post-Construction',
}

const FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

export default async function ManagerBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('bookings')
    .select('id, service_date, service_time, service_type, property_sqm, base_price, status, payment_status, profiles!customer_id (full_name)')
    .order('service_date', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data: bookings } = await query
  const list = (bookings ?? []) as unknown as Booking[]

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <Link href="/manager" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Dashboard
        </Link>
        <div className="flex items-baseline justify-between mt-2">
          <h1 className="text-xl font-bold text-gray-900">Bookings</h1>
          <span className="text-sm text-gray-400">{list.length} total</span>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={opt.value ? `/manager/bookings?status=${opt.value}` : '/manager/bookings'}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              (status ?? '') === opt.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {list.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">No bookings found.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.map((b) => (
              <Link
                key={b.id}
                href={`/manager/bookings/${b.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-medium text-gray-900">
                      {SERVICE_LABELS[b.service_type] ?? 'Cleaning'} · {b.property_sqm} sqm
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[b.status] ?? ''}`}>
                      {STATUS_LABELS[b.status] ?? b.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {b.profiles?.full_name ?? 'Customer'} · {formatDate(b.service_date)} at {formatTime(b.service_time)}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-bold text-gray-900">₱{Number(b.base_price).toLocaleString()}</p>
                  <p className="text-xs text-gray-400 capitalize mt-0.5 group-hover:text-blue-600 transition-colors">
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
