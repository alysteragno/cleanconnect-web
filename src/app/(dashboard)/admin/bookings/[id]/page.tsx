import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import PaymentForm from './payment-form'
import AdjustForm from './adjust-form'
import DispatchPanel from './dispatch-panel'
import PaymentVerificationCard from './payment-verification'
import CleanersForm from './cleaners-form'
import FurniturePhotoGrid from './furniture-photo-grid'

type Booking = {
  id: string
  created_at: string
  customer_id: string
  service_date: string
  service_time: string
  service_name: string | null
  space_type: string
  property_sqm: number
  required_cleaners: number
  duration_hours: number
  base_price: number
  cancellation_fee: number | null
  couch_quantity: number
  mattress_quantity: number
  furniture_quantity: number | null
  furniture_images: string[] | null
  status: string
  payment_status: string
  payment_method: string
  bank_used: string | null
  payment_reference: string | null
  payment_proof_url: string | null
  address_unit: string | null
  address_street: string | null
  address_city: string | null
  address_province: string | null
  special_notes: string | null
  profiles: { full_name: string; phone: string | null } | null
}

type Assignment = {
  cleaner_id: string
  status: string
  profiles: { full_name: string } | null
}

type Cleaner = { id: string; full_name: string; phone: string | null }

const STATUS_META: Record<string, { label: string; dot: string; badge: string }> = {
  pending:     { label: 'Pending',     dot: 'bg-amber-400',    badge: 'bg-amber-50 text-amber-700 border-amber-200'          },
  confirmed:   { label: 'Confirmed',   dot: 'bg-pink-500',     badge: 'bg-pink-50 text-pink-700 border-pink-200'             },
  in_progress: { label: 'In Progress', dot: 'bg-violet-500',   badge: 'bg-violet-50 text-violet-700 border-violet-200'       },
  completed:   { label: 'Completed',   dot: 'bg-emerald-500',  badge: 'bg-emerald-50 text-emerald-700 border-emerald-200'    },
  cancelled:   { label: 'Cancelled',   dot: 'bg-red-400',      badge: 'bg-red-50 text-red-600 border-red-200'                },
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
function formatBookedAt(ts: string) {
  return new Date(ts).toLocaleString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Manila',
  })
}

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const adminClient = createAdminClient()

  const [{ data: booking }, { data: assignments }, { data: cleaners }] = await Promise.all([
    adminClient
      .from('bookings')
      .select(`
        id, created_at, customer_id, service_date, service_time, service_name, space_type,
        property_sqm, required_cleaners, duration_hours, base_price,
        cancellation_fee, couch_quantity, mattress_quantity,
        furniture_quantity, furniture_images,
        status, payment_status, payment_method, bank_used, payment_reference, payment_proof_url,
        address_unit, address_street, address_city, address_province,
        special_notes,
        profiles!customer_id (full_name, phone)
      `)
      .eq('id', id)
      .single(),
    adminClient
      .from('cleaner_assignments')
      .select('cleaner_id, status, profiles!cleaner_id (full_name)')
      .eq('booking_id', id),
    adminClient
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'cleaner')
      .eq('is_active', true)
      .order('full_name'),
  ])

  if (!booking) notFound()

  // Fetched separately so a missing column (migration not yet applied) degrades
  // gracefully to null instead of 404ing the entire page.
  const { data: enRouteRow } = await adminClient
    .from('bookings')
    .select('cleaner_en_route_at')
    .eq('id', id)
    .maybeSingle()
  const cleanerEnRouteAt: string | null = (enRouteRow as { cleaner_en_route_at?: string | null } | null)?.cleaner_en_route_at ?? null

  const b = booking as unknown as Booking
  const assignmentList = (assignments ?? []) as unknown as Assignment[]
  const cleanerList = (cleaners ?? []) as Cleaner[]

  const { data: serviceRow } = await adminClient
    .from('services')
    .select('image_url')
    .eq('name', b.service_name ?? '')
    .maybeSingle()

  const serviceLabel    = b.service_name ?? '—'
  const serviceImageUrl = serviceRow?.image_url ?? null

  // furniture_images is a text[] of fully-qualified public URLs saved by the mobile app
  const signedPhotoUrls: string[] = b.furniture_images ?? []
  const photoCount = signedPhotoUrls.length
  const sm = STATUS_META[b.status] ?? { label: b.status, dot: 'bg-gray-400', badge: 'bg-gray-50 text-gray-600 border-gray-200' }
  const address = [b.address_unit, b.address_street, b.address_city, b.address_province].filter(Boolean).join(', ')

  return (
    <div className="max-w-6xl">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-7">
        <Link
          href="/admin/bookings"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Bookings
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                {serviceLabel}
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${sm.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sm.dot}`} />
                {sm.label}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {formatDate(b.service_date)}
              <span className="mx-2 text-gray-200">·</span>
              {formatTime(b.service_time)}
              {b.address_city && (
                <>
                  <span className="mx-2 text-gray-200">·</span>
                  {b.address_city}
                </>
              )}
            </p>
            <p className="mt-1.5 text-[11px] font-mono text-gray-300 tracking-wider">
              #{b.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      {/* ── Transportation fee warning ─────────────────────────────── */}
      {b.status === 'cancelled' && cleanerEnRouteAt && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">₱200 Transportation Fee Owed</p>
            <p className="text-xs text-amber-700 mt-0.5">
              The cleaner was already en route when this booking was cancelled. The assigned cleaner(s) are entitled to a ₱200 transportation fee — please follow up on collection manually.
            </p>
          </div>
        </div>
      )}

      {/* ── Two-column layout ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">

        {/* ── Left column ─────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Customer */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                Customer
              </p>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-pink-100 text-pink-600 font-bold text-sm flex items-center justify-center shrink-0 select-none">
                  {b.profiles?.full_name?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{b.profiles?.full_name ?? '—'}</p>
                  {b.profiles?.phone && (
                    <p className="text-xs text-gray-400 mt-0.5">{b.profiles.phone}</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Booking Details */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {serviceImageUrl && (
              <div className="relative h-44 overflow-hidden">
                <Image
                  src={serviceImageUrl}
                  alt={serviceLabel}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1280px) 100vw, 800px"
                />
              </div>
            )}
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                Booking Details
              </p>
            </div>
            <div className="px-6 py-2">
              <DetailRow label="Date"               value={formatDate(b.service_date)} />
              <DetailRow label="Time"               value={formatTime(b.service_time)} />
              <DetailRow label="Booked On"          value={formatBookedAt(b.created_at)} />
              <DetailRow label="Address"            value={address || '—'} />
              <DetailRow label="Service"            value={serviceLabel} />
              <DetailRow label="Space Type"         value={b.space_type ? b.space_type.charAt(0).toUpperCase() + b.space_type.slice(1) : '—'} />
              <DetailRow label="Property Size"      value={`${b.property_sqm} sqm`} />
              <CleanersForm bookingId={b.id} currentCount={b.required_cleaners ?? 1} />
              <DetailRow label="Duration"           value={b.duration_hours ? `${b.duration_hours} hours` : '—'} />
              {b.couch_quantity > 0    && <DetailRow label="Sofa Seater"         value={String(b.couch_quantity)} />}
              {b.mattress_quantity > 0 && <DetailRow label="Mattresses"           value={String(b.mattress_quantity)} />}
              <DetailRow label="Number of Furniture"  value={String(b.furniture_quantity ?? 0)} />
              {b.special_notes         && <DetailRow label="Notes"                value={b.special_notes} />}
            </div>
          </section>

          {/* Furniture Photos */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                Furniture Photos
              </p>
              <span className="text-[11px] text-gray-400">
                {photoCount} / 5 uploaded
              </span>
            </div>
            <div className="px-6 py-5">
              {photoCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">No furniture photos uploaded yet.</p>
                  <p className="text-xs text-gray-300 mt-1">Customer must upload 5 photos before service.</p>
                </div>
              ) : (
                <FurniturePhotoGrid urls={signedPhotoUrls} />
              )}
            </div>
          </section>

          {/* Payment */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                Payment
              </p>
            </div>

            {/* Responsive 2-col split: left = amount + verification, right = forms */}
            <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-gray-100">

              {/* Left — amount + verification */}
              <div className="px-6 py-5 space-y-5 border-b md:border-b-0 border-gray-100">
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                    Amount Due
                  </p>
                  <p className="text-4xl font-bold text-gray-900 tabular-nums tracking-tight">
                    ₱{Number(b.base_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                  {b.cancellation_fee != null && (
                    <p className="text-xs text-red-500 mt-2">
                      + ₱{Number(b.cancellation_fee).toLocaleString('en-PH', { minimumFractionDigits: 2 })} cancellation fee (transport)
                    </p>
                  )}
                </div>

                <div className="pt-1">
                  <PaymentVerificationCard
                    bookingId={b.id}
                    paymentMethod={b.payment_method}
                    bankUsed={b.bank_used}
                    paymentStatus={b.payment_status}
                    paymentReference={b.payment_reference}
                    paymentProofUrl={b.payment_proof_url}
                  />
                </div>
              </div>

              {/* Right — status update + billing adjustment */}
              <div className="divide-y divide-gray-100">
                <div className="px-6 py-5">
                  <PaymentForm bookingId={b.id} />
                </div>
                <div className="px-6 py-5">
                  <AdjustForm bookingId={b.id} currentAmount={Number(b.base_price)} />
                </div>
              </div>

            </div>
          </section>
        </div>

        {/* ── Right column — Dispatch ──────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
              Cleaner Deployment
            </p>
          </div>
          <div className="p-6">
            <DispatchPanel
              bookingId={b.id}
              bookingStatus={b.status}
              paymentStatus={b.payment_status}
              paymentMethod={b.payment_method}
              serviceDate={b.service_date}
              cleaners={cleanerList}
              assignments={assignmentList}
            />
          </div>
        </div>

      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-gray-50 last:border-0 gap-6">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  )
}
