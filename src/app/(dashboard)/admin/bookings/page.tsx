import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import { SortSelect } from '@/components/dashboard/sort-select'
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
  payment_method: string
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
  unpaid:   'Unpaid',
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
    timeZone: 'Asia/Manila',
  })
}

const SORT_OPTIONS = [
  { value: 'date_desc',    label: 'Service Date (Newest)' },
  { value: 'date_asc',     label: 'Service Date (Oldest)' },
  { value: 'booked_desc',  label: 'Booked Date (Newest)' },
  { value: 'booked_asc',   label: 'Booked Date (Oldest)' },
  { value: 'price_desc',   label: 'Price (High → Low)' },
  { value: 'price_asc',    label: 'Price (Low → High)' },
]

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string }>
}) {
  const { status, sort } = await searchParams
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const basePath = await getBasePath()
  const supabase = createAdminClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, created_at, service_date, service_time, service_name, property_sqm, base_price, status, payment_status, payment_method, address_city, profiles!customer_id (full_name)')
    .order('service_date', { ascending: false })

  const all = (bookings ?? []) as unknown as Booking[]

  const counts: Record<string, number> = {}
  for (const b of all) counts[b.status] = (counts[b.status] ?? 0) + 1

  const filtered = status ? all.filter((b) => b.status === status) : all

  const sortKey = sort ?? 'date_desc'
  const list = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case 'date_asc':    return a.service_date.localeCompare(b.service_date)
      case 'booked_desc': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'booked_asc':  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'price_desc':  return Number(b.base_price) - Number(a.base_price)
      case 'price_asc':   return Number(a.base_price) - Number(b.base_price)
      default:            return b.service_date.localeCompare(a.service_date)
    }
  })

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400 mb-1">Admin</p>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`${basePath}/bookings/new`}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 transition-colors shadow-sm"
          >
            + New Booking
          </Link>
          <SortSelect options={SORT_OPTIONS} />
          <p className="text-sm text-gray-400 tabular-nums">{all.length} total</p>
        </div>
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
              href={opt.value ? `${basePath}/bookings?status=${opt.value}` : `${basePath}/bookings`}
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
            <div className="flex items-center px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
              <span className="flex-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Booking</span>
              <span className="w-24 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-right">Amount</span>
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
                    href={`${basePath}/bookings/${b.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/70 transition-colors group"
                  >
                    {/* Service thumbnail with status dot */}
                    <div className="relative shrink-0">
                      <div className="w-[60px] h-[60px] rounded-xl overflow-hidden shadow-sm bg-pink-50">
                        {serviceImage ? (
                          <Image
                            src={serviceImage}
                            alt={serviceLabel}
                            width={60}
                            height={60}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${sm.dot}`} />
                    </div>

                    {/* Text content — grows, truncates */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 group-hover:text-pink-700 transition-colors truncate">
                          {serviceLabel}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">{b.property_sqm} sqm</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${sm.pill}`}>
                          {sm.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        <span className="font-medium text-gray-700">{b.profiles?.full_name ?? '—'}</span>
                        <span className="mx-1 text-gray-300">·</span>
                        {formatDate(b.service_date)}
                        <span className="mx-1 text-gray-300">·</span>
                        {formatTime(b.service_time)}
                        {b.address_city && (
                          <>
                            <span className="mx-1 text-gray-300">·</span>
                            {b.address_city}
                          </>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                        Booked {formatBookedAt(b.created_at)}
                      </p>
                    </div>

                    {/* Price + payment — fixed width, never shrinks */}
                    <div className="text-right shrink-0 w-24">
                      <p className="text-sm font-bold text-gray-900 tabular-nums">
                        ₱{Number(b.base_price).toLocaleString('en-PH')}
                      </p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold mt-0.5 inline-block ${pm}`}>
                        {PAYMENT_LABELS[b.payment_status] ?? b.payment_status}
                      </span>
                      <p className="text-[11px] text-gray-400 mt-0.5 capitalize">{b.payment_method}</p>
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
