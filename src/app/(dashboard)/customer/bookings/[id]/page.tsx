import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

type Booking = {
  id: string
  service_date: string
  service_time: string
  service_type: string
  space_type: string
  property_sqm: number
  required_cleaners: number
  duration_hours: number
  base_price: number
  status: string
  payment_status: string
  payment_method: string
  address_unit: string | null
  address_street: string | null
  address_city: string | null
  address_province: string | null
  special_notes: string | null
  created_at: string
  branches: { name: string; region: string } | null
}

type FeedbackRow = { id: string; rating: number; comment: string | null }

const STATUS_STEPS = ['pending', 'confirmed', 'in_progress', 'completed'] as const
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
const STATUS_DESCRIPTIONS: Record<string, string> = {
  pending: 'Your booking has been received and is awaiting confirmation.',
  confirmed: 'A cleaner has been assigned. They will arrive within the scheduled window.',
  in_progress: 'Your cleaner is currently on site.',
  completed: 'Service complete. Thank you for using CleanConnect!',
  cancelled: 'This booking was cancelled.',
}
const SERVICE_LABELS: Record<string, string> = {
  general: 'General Home Cleaning',
  premium_mattress: 'Mattress & Upholstery',
  complete: 'Complete Package',
  disinfection: 'Disinfection',
  post_construction: 'Post-Construction',
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: booking }, { data: feedback }] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        'id, service_date, service_time, service_type, space_type, property_sqm, required_cleaners, duration_hours, base_price, status, payment_status, payment_method, address_unit, address_street, address_city, address_province, special_notes, created_at, branches (name, region)'
      )
      .eq('id', id)
      .single(),
    supabase.from('feedback').select('id, rating, comment').eq('booking_id', id).maybeSingle(),
  ])

  if (!booking) notFound()

  const b = booking as unknown as Booking
  const fb = feedback as FeedbackRow | null

  const statusIndex = STATUS_STEPS.indexOf(b.status as (typeof STATUS_STEPS)[number])
  const isCancelled = b.status === 'cancelled'
  const isCompleted = b.status === 'completed'

  const address = [b.address_unit, b.address_street, b.address_city, b.address_province]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/customer/bookings" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← My Bookings
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">
          {SERVICE_LABELS[b.service_type] ?? 'Cleaning Service'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {b.branches?.name} · Booked on{' '}
          {new Date(b.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Status tracker */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Status</p>

        {isCancelled ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-semibold text-red-700">Cancelled</p>
            <p className="text-xs text-red-500 mt-0.5">This booking was cancelled.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {STATUS_STEPS.map((s, i) => {
              const done = i < statusIndex
              const active = i === statusIndex
              return (
                <div key={s} className="flex items-start gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        done
                          ? 'bg-green-500 text-white'
                          : active
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {done ? '✓' : i + 1}
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div className={`w-0.5 h-6 mt-1 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                    )}
                  </div>
                  <div className="pb-2">
                    <p
                      className={`text-sm font-semibold ${
                        active ? 'text-blue-700' : done ? 'text-gray-700' : 'text-gray-400'
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </p>
                    {active && (
                      <p className="text-xs text-gray-500 mt-0.5">{STATUS_DESCRIPTIONS[s]}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Booking details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Details</p>
        <div className="divide-y divide-gray-100">
          <Row label="Date" value={formatDate(b.service_date)} />
          <Row label="Time" value={formatTime(b.service_time)} />
          <Row label="Address" value={address || '—'} />
          <Row label="Service" value={SERVICE_LABELS[b.service_type] ?? b.service_type} />
          <Row label="Space" value={b.space_type ? b.space_type.charAt(0).toUpperCase() + b.space_type.slice(1) : '—'} />
          <Row label="Size" value={`${b.property_sqm} sqm`} />
          <Row label="Cleaners" value={`${b.required_cleaners ?? '—'}`} />
          <Row label="Duration" value={b.duration_hours ? `${b.duration_hours}h` : '—'} />
          {b.special_notes && <Row label="Notes" value={b.special_notes} />}
        </div>
      </div>

      {/* Payment */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Payment</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900">₱{Number(b.base_price).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-0.5 capitalize">
              {b.payment_method} · {b.payment_status}
            </p>
          </div>
          <span
            className={`text-sm px-3 py-1 rounded-full font-semibold capitalize ${
              b.payment_status === 'paid'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : b.payment_status === 'partial'
                ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {b.payment_status}
          </span>
        </div>
      </div>

      {/* Feedback */}
      {isCompleted && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Feedback</p>
          {fb ? (
            <div>
              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < fb.rating ? 'text-yellow-400' : 'text-gray-200'}>
                    ★
                  </span>
                ))}
                <span className="text-sm text-gray-500 ml-1">{fb.rating}/5</span>
              </div>
              {fb.comment && <p className="text-sm text-gray-600 italic">&ldquo;{fb.comment}&rdquo;</p>}
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                How did the service go? Your feedback helps us improve.
              </p>
              <Link
                href={`/customer/feedback/${b.id}`}
                className="inline-block text-sm px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Leave feedback
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2.5 gap-4">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  )
}
