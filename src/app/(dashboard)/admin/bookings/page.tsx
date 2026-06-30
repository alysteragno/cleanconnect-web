import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/utils/supabase/server'
function getServiceImage(name: string | null): string | null {
  if (!name) return null
  const n = name.toLowerCase()
  if (n.includes('aircon') || n.includes('air con') || n.includes('air conditioning')) {
    if (n.includes('repair')) return '/service_image/aircon_repair.webp'
    return '/service_image/aircon_cleaning.webp'
  }
  if (n.includes('sofa') || n.includes('couch')) return '/service_image/sofa_deepcleaning.webp'
  if (n.includes('carpet')) return '/service_image/carpet_cleaning.webp'
  if (n.includes('curtain')) return '/service_image/curtain_drycleaning.webp'
  if (n.includes('mattress')) return '/service_image/mattress_deepCleaning.webp'
  if (n.includes('grease') || n.includes('greasetrap')) {
    if (n.includes('install')) return '/service_image/greasetrap_installation.webp'
    return '/service_image/greasetrap.webp'
  }
  if (n.includes('post') || n.includes('construction')) return '/service_image/post_construction.webp'
  if (n.includes('office')) return '/service_image/office_cleaning.webp'
  if (n.includes('condo')) return '/service_image/condo_cleaning.jpeg'
  if (n.includes('general')) return '/service_image/general_cleaning.webp'
  return null
}

type Booking = {
  id: string
  created_at: string
  service_date: string
  service_time: string
  service_name: string | null
  property_sqm: number
  base_price: number
  status: string
  payment_status: string
  address_city: string | null
  profiles: { full_name: string } | null
}

const STATUS_META: Record<string, { dot: string; pill: string; label: string }> = {
  pending:     { dot: 'bg-yellow-400', pill: 'bg-yellow-50 text-yellow-700 border-yellow-200',   label: 'Pending' },
  confirmed:   { dot: 'bg-pink-500',   pill: 'bg-pink-50 text-pink-700 border-pink-200',         label: 'Confirmed' },
  in_progress: { dot: 'bg-purple-500', pill: 'bg-purple-50 text-purple-700 border-purple-200',   label: 'In Progress' },
  completed:   { dot: 'bg-green-500',  pill: 'bg-green-50 text-green-700 border-green-200',      label: 'Completed' },
  cancelled:   { dot: 'bg-red-400',    pill: 'bg-red-50 text-red-600 border-red-200',            label: 'Cancelled' },
}

const PAYMENT_STYLES: Record<string, string> = {
  unpaid:   'bg-red-50 text-red-600 border-red-200',
  paid:     'bg-green-50 text-green-600 border-green-200',
  refunded: 'bg-blue-50 text-blue-600 border-blue-200',
  partial:  'bg-amber-50 text-amber-600 border-amber-200',
}

const PAYMENT_LABELS: Record<string, string> = {
  unpaid:   'Payment pending confirmation',
  paid:     'Paid',
  refunded: 'Refunded',
  partial:  'Partial',
}

const STATUS_OPTS = [
  { value: '',            label: 'All' },
  { value: 'pending',     label: 'Pending' },
  { value: 'confirmed',   label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
]

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}
function formatBookedAt(ts: string) {
  return new Date(ts).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const supabase = createAdminClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, created_at, service_date, service_time, service_name, property_sqm, base_price, status, payment_status, address_city, profiles!customer_id (full_name)')
    .order('service_date', { ascending: false })

  const all = (bookings ?? []) as unknown as Booking[]

  const counts: Record<string, number> = {}
  for (const b of all) counts[b.status] = (counts[b.status] ?? 0) + 1

  const list = status ? all.filter((b) => b.status === status) : all

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Admin</p>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        </div>
        <p className="text-sm text-gray-400 tabular-nums">{all.length} total</p>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTS.map((opt) => {
          const count = opt.value ? (counts[opt.value] ?? 0) : all.length
          const isActive = (status ?? '') === opt.value
          const dot = opt.value ? STATUS_META[opt.value]?.dot : undefined
          return (
            <Link
              key={opt.value}
              href={opt.value ? `/admin/bookings?status=${opt.value}` : '/admin/bookings'}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isActive
                  ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
              }`}
            >
              {dot && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-white/60' : dot}`} />
              )}
              {opt.label}
              <span className={`tabular-nums ${isActive ? 'text-white/60' : 'text-gray-400'}`}>
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        {list.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">No bookings found</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {status ? `No ${status.replace('_', ' ')} bookings yet.` : 'Bookings will appear here once created.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Column header row */}
            <div className="hidden sm:grid grid-cols-[1fr_8rem] px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Booking</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-right">Amount</span>
            </div>

            <div className="divide-y divide-gray-100">
              {list.map((b) => {
                const sm = STATUS_META[b.status] ?? { dot: 'bg-gray-400', pill: 'bg-gray-50 text-gray-600 border-gray-200', label: b.status }
                const pm = PAYMENT_STYLES[b.payment_status] ?? 'bg-gray-50 text-gray-500 border-gray-200'
                const serviceLabel = b.service_name ?? '—'
                const serviceImage = getServiceImage(b.service_name)
                return (
                  <Link
                    key={b.id}
                    href={`/admin/bookings/${b.id}`}
                    className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_8rem] items-center px-5 py-3.5 hover:bg-gray-50/70 transition-colors group"
                  >
                    {/* Main info */}
                    <div className="min-w-0 flex items-center gap-4">
                      {/* Service thumbnail with status badge */}
                      <div className="relative shrink-0">
                        <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden shadow-sm bg-pink-50">
                          {serviceImage ? (
                            <Image
                              src={serviceImage}
                              alt={serviceLabel}
                              width={72}
                              height={72}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-6 h-6 text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        {/* Status badge overlaid on image corner */}
                        <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${sm.dot}`} />
                      </div>

                      {/* Text content */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-gray-900 group-hover:text-pink-700 transition-colors">
                            {serviceLabel}
                          </span>
                          <span className="text-xs text-gray-400">{b.property_sqm} sqm</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${sm.pill}`}>
                            {sm.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          <span className="font-medium text-gray-700">{b.profiles?.full_name ?? '—'}</span>
                          <span className="mx-1.5 text-gray-300">·</span>
                          {formatDate(b.service_date)}
                          <span className="mx-1.5 text-gray-300">·</span>
                          {formatTime(b.service_time)}
                          {b.address_city && (
                            <>
                              <span className="mx-1.5 text-gray-300">·</span>
                              {b.address_city}
                            </>
                          )}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Booked {formatBookedAt(b.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Price + payment */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900 tabular-nums">
                        ₱{Number(b.base_price).toLocaleString('en-PH')}
                      </p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold mt-0.5 inline-block ${pm}`}>
                        {PAYMENT_LABELS[b.payment_status] ?? b.payment_status}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
