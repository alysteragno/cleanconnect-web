import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import JobActions from './job-actions'

type AssignmentRow = {
  id: string
  status: string
  started_at: string | null
  assigned_at: string
  bookings: {
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
    payment_method: string
    address_unit: string | null
    address_street: string | null
    address_city: string | null
    address_province: string | null
    special_notes: string | null
    profiles: { full_name: string } | null
    branches: { name: string; region: string } | null
  } | null
}

const SERVICE_LABELS: Record<string, string> = {
  general: 'General Home Cleaning',
  premium_mattress: 'Mattress & Upholstery',
  complete: 'Complete Package',
  disinfection: 'Disinfection',
  post_construction: 'Post-Construction',
}

const STATUS_BADGE: Record<string, string> = {
  offered: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  accepted: 'bg-blue-50 text-blue-700 border-blue-200',
  declined: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('cleaner_assignments')
    .select(`
      id, status, started_at, assigned_at,
      bookings (
        id, service_date, service_time, service_type, space_type,
        property_sqm, required_cleaners, duration_hours, base_price,
        status, payment_method, address_unit, address_street,
        address_city, address_province, special_notes,
        profiles!customer_id (full_name),
        branches (name, region)
      )
    `)
    .eq('id', id)
    .single()

  if (!data) notFound()

  const a = data as unknown as AssignmentRow
  const b = a.bookings
  if (!b) notFound()

  const address = [b.address_unit, b.address_street, b.address_city, b.address_province]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link href="/cleaner" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Dashboard
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-xl font-bold text-gray-900">
            {SERVICE_LABELS[b.service_type] ?? 'Cleaning Job'}
          </h1>
          <span
            className={`text-xs px-2 py-0.5 rounded-full border font-semibold capitalize ${STATUS_BADGE[a.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}
          >
            {a.status.replace('_', ' ')}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {b.branches?.name} · Assigned{' '}
          {new Date(a.assigned_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
        </p>
      </div>

      {/* Action panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <JobActions
          assignmentId={a.id}
          assignmentStatus={a.status}
          bookingStatus={b.status}
          paymentMethod={b.payment_method}
          startedAt={a.started_at}
        />
      </div>

      {/* Booking details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Job Details</p>
        <div className="divide-y divide-gray-100">
          <Row label="Date" value={formatDate(b.service_date)} />
          <Row label="Time" value={formatTime(b.service_time)} />
          <Row label="Address" value={address || '—'} />
          <Row label="Service" value={SERVICE_LABELS[b.service_type] ?? b.service_type} />
          <Row
            label="Space"
            value={b.space_type ? b.space_type.charAt(0).toUpperCase() + b.space_type.slice(1) : '—'}
          />
          <Row label="Size" value={`${b.property_sqm} sqm`} />
          <Row label="Cleaners" value={`${b.required_cleaners ?? '—'} cleaner(s)`} />
          <Row label="Duration" value={b.duration_hours ? `${b.duration_hours}h` : '—'} />
          <Row label="Pay" value={`₱${Number(b.base_price).toLocaleString()} (${b.payment_method})`} />
          {b.special_notes && <Row label="Notes" value={b.special_notes} />}
        </div>
      </div>

      {/* Customer info */}
      {b.profiles?.full_name && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Customer</p>
          <p className="text-sm text-gray-900 font-medium">{b.profiles.full_name}</p>
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
