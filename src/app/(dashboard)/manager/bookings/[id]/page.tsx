import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import DispatchPanel from './dispatch-panel'

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
  profiles: { full_name: string; phone: string | null } | null
  branches: { id: string; name: string } | null
}

type Assignment = {
  cleaner_id: string
  status: string
  profiles: { full_name: string } | null
}

type Cleaner = { id: string; full_name: string; phone: string | null }

const SERVICE_LABELS: Record<string, string> = {
  general: 'General Home Cleaning',
  premium_mattress: 'Mattress & Upholstery',
  complete: 'Complete Package',
  disinfection: 'Disinfection',
  post_construction: 'Post-Construction',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
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

export default async function ManagerBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: booking }, { data: assignments }] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        id, service_date, service_time, service_type, space_type,
        property_sqm, required_cleaners, duration_hours, base_price,
        status, payment_status, payment_method,
        address_unit, address_street, address_city, address_province,
        special_notes,
        profiles!customer_id (full_name, phone),
        branches (id, name)
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('cleaner_assignments')
      .select('cleaner_id, status, profiles!cleaner_id (full_name)')
      .eq('booking_id', id),
  ])

  if (!booking) notFound()

  const b = booking as unknown as Booking
  const assignmentList = (assignments ?? []) as unknown as Assignment[]

  // Fetch cleaners in this branch for the dispatch panel
  const { data: cleaners } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('branch_id', b.branches?.id ?? '')
    .eq('role', 'cleaner')
    .order('full_name')

  const cleanerList = (cleaners ?? []) as Cleaner[]

  const address = [b.address_unit, b.address_street, b.address_city, b.address_province]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link href="/manager/bookings" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Bookings
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-xl font-bold text-gray-900">
            {SERVICE_LABELS[b.service_type] ?? 'Booking'}
          </h1>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold capitalize ${STATUS_STYLES[b.status] ?? ''}`}>
            {b.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — booking details */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Booking Details</p>
            <div className="divide-y divide-gray-100">
              <Row label="Date" value={formatDate(b.service_date)} />
              <Row label="Time" value={formatTime(b.service_time)} />
              <Row label="Address" value={address || '—'} />
              <Row label="Service" value={SERVICE_LABELS[b.service_type] ?? b.service_type} />
              <Row label="Space" value={b.space_type ? b.space_type.charAt(0).toUpperCase() + b.space_type.slice(1) : '—'} />
              <Row label="Size" value={`${b.property_sqm} sqm`} />
              <Row label="Cleaners needed" value={`${b.required_cleaners ?? '—'}`} />
              <Row label="Duration" value={b.duration_hours ? `${b.duration_hours}h` : '—'} />
              {b.special_notes && <Row label="Notes" value={b.special_notes} />}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</p>
            <div className="divide-y divide-gray-100">
              <Row label="Name" value={b.profiles?.full_name ?? '—'} />
              {b.profiles?.phone && <Row label="Phone" value={b.profiles.phone} />}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Payment</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">₱{Number(b.base_price).toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-0.5 capitalize">{b.payment_method} · {b.payment_status}</p>
              </div>
              <span className={`text-sm px-3 py-1 rounded-full font-semibold capitalize border ${
                b.payment_status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' :
                b.payment_status === 'partial' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                'bg-red-50 text-red-700 border-red-200'
              }`}>
                {b.payment_status}
              </span>
            </div>
          </div>
        </div>

        {/* Right — dispatch panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-5">
            Cleaner Deployment
          </p>
          <DispatchPanel
            bookingId={b.id}
            bookingStatus={b.status}
            cleaners={cleanerList}
            assignments={assignmentList}
          />
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 gap-4">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  )
}
