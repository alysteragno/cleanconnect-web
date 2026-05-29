import { createClient } from '@/utils/supabase/server'
import NewBookingForm from './new-booking-form'

type Branch = { id: string; name: string; region: string }

type Booking = {
  id: string
  service_date: string
  service_time: string
  property_sqm: number
  required_cleaners: number
  duration_hours: number
  base_price: number
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded'
  created_at: string
  branches: { name: string; region: string } | null
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

const PAYMENT_STYLES: Record<string, string> = {
  unpaid: 'text-red-600',
  partial: 'text-yellow-600',
  paid: 'text-green-600',
  refunded: 'text-gray-400',
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 || 12
  return `${display}:${m} ${suffix}`
}

export default async function CustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string }>
}) {
  const { booked } = await searchParams
  const supabase = await createClient()

  const [{ data: branches }, { data: bookings }] = await Promise.all([
    supabase.from('branches').select('id, name, region').order('name'),
    supabase
      .from('bookings')
      .select(
        'id, service_date, service_time, property_sqm, required_cleaners, duration_hours, base_price, status, payment_status, created_at, branches (name, region)'
      )
      .order('created_at', { ascending: false }),
  ])

  const bookingList = (bookings ?? []) as unknown as Booking[]

  return (
    <div className="max-w-3xl space-y-8">
      {booked && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          <span className="font-semibold">Booking confirmed!</span> Your service has been scheduled.
          Check below for details.
        </div>
      )}

      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Book a service</h2>
        <p className="text-sm text-gray-500 mb-6">
          Enter your property details for an instant price estimate.
        </p>
        <NewBookingForm branches={(branches ?? []) as Branch[]} />
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-base font-semibold text-gray-900">Your bookings</h2>
          <span className="text-sm text-gray-400">
            {bookingList.length} {bookingList.length === 1 ? 'booking' : 'bookings'}
          </span>
        </div>

        {bookingList.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">
            No bookings yet. Schedule your first service above.
          </p>
        ) : (
          <div className="space-y-3">
            {bookingList.map((booking) => (
              <div
                key={booking.id}
                className="border border-gray-100 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {booking.branches?.name ?? 'Unknown branch'}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[booking.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}
                    >
                      {STATUS_LABELS[booking.status] ?? booking.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {formatDate(booking.service_date)} at {formatTime(booking.service_time)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {booking.property_sqm} sqm &middot; {booking.required_cleaners}{' '}
                    {booking.required_cleaners === 1 ? 'cleaner' : 'cleaners'} &middot;{' '}
                    {booking.duration_hours}h
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-gray-900">
                    ₱{Number(booking.base_price).toLocaleString()}
                  </p>
                  <p
                    className={`text-xs font-medium capitalize ${PAYMENT_STYLES[booking.payment_status] ?? 'text-gray-500'}`}
                  >
                    {booking.payment_status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
