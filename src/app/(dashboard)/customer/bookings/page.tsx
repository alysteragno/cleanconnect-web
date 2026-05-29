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
  created_at: string
  branches: { name: string } | null
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

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export default async function BookingsPage() {
  const supabase = await createClient()
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, service_date, service_time, service_type, property_sqm, base_price, status, payment_status, created_at, branches (name)')
    .order('created_at', { ascending: false })

  const list = (bookings ?? []) as unknown as Booking[]

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/customer" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Dashboard
        </Link>
        <div className="flex items-baseline justify-between mt-2">
          <h1 className="text-xl font-bold text-gray-900">My Bookings</h1>
          <span className="text-sm text-gray-400">{list.length} total</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {list.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-400 mb-4">No bookings yet.</p>
            <Link
              href="/customer/book"
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Book your first cleaning
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.map((b) => (
              <Link
                key={b.id}
                href={`/customer/bookings/${b.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {SERVICE_LABELS[b.service_type] ?? 'Cleaning Service'}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[b.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}
                    >
                      {STATUS_LABELS[b.status] ?? b.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {b.branches?.name} · {formatDate(b.service_date)} at {formatTime(b.service_time)}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-bold text-gray-900">₱{Number(b.base_price).toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize group-hover:text-blue-600 transition-colors">
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
