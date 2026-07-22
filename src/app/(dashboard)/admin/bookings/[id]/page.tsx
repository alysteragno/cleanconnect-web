import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import PaymentForm from './payment-form'
import AdjustForm from './adjust-form'
import DispatchPanel from './dispatch-panel'
import PaymentVerificationCard from './payment-verification'
import PayMongoCheckout from './paymongo-checkout'
import CleanersForm from './cleaners-form'
import FurniturePhotoGrid from './furniture-photo-grid'
import { serviceNeedsSqm } from '@/lib/booking-pricing'

type Booking = {
  id: string
  created_at: string
  customer_id: string
  service_date: string
  service_time: string
  service_name: string | null
  service_slug: string | null
  service_image: string | null
  space_type: string
  property_sqm: number
  required_cleaners: number
  duration_hours: number
  base_price: number
  cancellation_fee: number | null
  sofa_seaters: number | null
  other_furniture: string | null
  furniture_images: string[] | null
  status: string
  payment_status: string
  payment_method: string
  bank_used: string | null
  payment_reference: string | null
  payment_proof_url: string | null
  address_unit: string | null
  address_street: string | null
  address_barangay: string | null
  address_city: string | null
  address_province: string | null
  service_lat: number | null
  service_lng: number | null
  special_notes: string | null
  profiles: { full_name: string; phone: string | null } | null
}

type Assignment = {
  cleaner_id: string
  status: string
  en_route_at: string | null
  en_route_lat: number | null
  en_route_lng: number | null
  arrived_at: string | null
  arrived_lat: number | null
  arrived_lng: number | null
  profiles: { full_name: string; photo_url: string | null } | null
}

type Cleaner = { id: string; full_name: string; phone: string | null; photo_url: string | null }

type Review = { rating: number; comment: string | null; created_at: string }

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

  const basePath = await getBasePath()
  const adminClient = createAdminClient()

  const [{ data: booking }, { data: assignments }, { data: cleaners }, { data: reviewRow }] = await Promise.all([
    adminClient
      .from('bookings')
      .select(`
        id, created_at, customer_id, service_date, service_time, service_name,
        service_slug, service_image, space_type,
        property_sqm, required_cleaners, duration_hours, base_price,
        cancellation_fee, sofa_seaters, other_furniture, furniture_images,
        status, payment_status, payment_method, bank_used, payment_reference, payment_proof_url,
        address_unit, address_street, address_barangay, address_city, address_province,
        service_lat, service_lng,
        special_notes,
        profiles!customer_id (full_name, phone)
      `)
      .eq('id', id)
      .single(),
    adminClient
      .from('cleaner_assignments')
      .select('cleaner_id, status, profiles!cleaner_id (full_name, photo_url)')
      .eq('booking_id', id),
    adminClient
      .from('profiles')
      .select('id, full_name, phone, photo_url')
      .eq('role', 'cleaner')
      .eq('is_active', true)
      .order('full_name'),
    adminClient
      .from('feedback')
      .select('rating, comment, created_at')
      .eq('booking_id', id)
      .maybeSingle(),
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

  // Same graceful pattern for the PayMongo columns — degrades to null if the
  // migration_paymongo.sql migration has not been applied yet.
  const { data: paymongoRow } = await adminClient
    .from('bookings')
    .select('paymongo_checkout_url, paymongo_payment_id')
    .eq('id', id)
    .maybeSingle()
  const paymongoData = (paymongoRow as { paymongo_checkout_url?: string | null; paymongo_payment_id?: string | null } | null)
  const paymongoCheckoutUrl: string | null = paymongoData?.paymongo_checkout_url ?? null
  const paymongoPaymentId: string | null = paymongoData?.paymongo_payment_id ?? null

  // Same graceful pattern again for the per-cleaner geotag columns — degrades
  // to no geotags if migration_cleaner_geotags.sql has not been applied yet.
  const { data: geotagRows } = await adminClient
    .from('cleaner_assignments')
    .select('cleaner_id, en_route_at, en_route_lat, en_route_lng, arrived_at, arrived_lat, arrived_lng')
    .eq('booking_id', id)
  type GeotagRow = { cleaner_id: string; en_route_at: string | null; en_route_lat: number | null; en_route_lng: number | null; arrived_at: string | null; arrived_lat: number | null; arrived_lng: number | null }
  const geotagMap = new Map((geotagRows ?? []).map((g) => [(g as GeotagRow).cleaner_id, g as GeotagRow]))

  const b = booking as unknown as Booking
  const assignmentList = ((assignments ?? []) as unknown as Assignment[]).map((a) => ({
    ...a,
    ...(geotagMap.get(a.cleaner_id) ?? { en_route_at: null, en_route_lat: null, en_route_lng: null, arrived_at: null, arrived_lat: null, arrived_lng: null }),
  }))
  const cleanerList = (cleaners ?? []) as Cleaner[]

  // service_image is saved directly on newer bookings; older rows fall back to
  // a slug/name lookup against the current services table.
  let serviceImageUrl = b.service_image ?? null
  if (!serviceImageUrl && b.service_slug) {
    const { data: bySlug } = await adminClient
      .from('services').select('image_url').eq('slug', b.service_slug).maybeSingle()
    serviceImageUrl = bySlug?.image_url ?? null
  }
  if (!serviceImageUrl && b.service_name) {
    const { data: byName } = await adminClient
      .from('services').select('image_url').eq('name', b.service_name).maybeSingle()
    serviceImageUrl = byName?.image_url ?? null
  }

  const serviceLabel = b.service_name ?? '—'

  // furniture_images is a text[] of fully-qualified public URLs saved by the mobile app
  const signedPhotoUrls: string[] = b.furniture_images ?? []
  const photoCount = signedPhotoUrls.length
  const review = reviewRow as Review | null
  const sm = STATUS_META[b.status] ?? { label: b.status, dot: 'bg-gray-400', badge: 'bg-gray-50 text-gray-600 border-gray-200' }
  const address = [b.address_unit, b.address_street, b.address_barangay, b.address_city, b.address_province].filter(Boolean).join(', ')
  const hasPin = b.service_lat != null && b.service_lng != null

  return (
    <div className="max-w-6xl">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-7">
        <Link
          href={`${basePath}/bookings`}
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
              {serviceNeedsSqm(b.service_slug) && (
                <DetailRow label="Property Size"      value={`${b.property_sqm} sqm`} />
              )}
              <CleanersForm bookingId={b.id} currentCount={b.required_cleaners ?? 1} />
              <DetailRow label="Duration"           value={b.duration_hours ? `${b.duration_hours} hours` : '—'} />
              {b.sofa_seaters != null && b.sofa_seaters > 0 && <DetailRow label="Sofa Seaters" value={String(b.sofa_seaters)} />}
              {b.other_furniture       && <DetailRow label="Other Furniture"      value={b.other_furniture} />}
              <DetailRow label="Location Pinned"    value={hasPin ? `${b.service_lat!.toFixed(5)}, ${b.service_lng!.toFixed(5)}` : 'Not pinned'} />
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
                {photoCount} uploaded
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
                  <p className="text-sm text-gray-400">No furniture photos or video uploaded yet.</p>
                </div>
              ) : (
                <FurniturePhotoGrid urls={signedPhotoUrls} />
              )}
            </div>
          </section>

          {/* Customer Review */}
          {b.status === 'completed' && (
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                  Customer Review
                </p>
              </div>
              <div className="px-6 py-5">
                {review ? (
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <Stars rating={review.rating} />
                      <p className="text-xs text-gray-400 shrink-0">
                        {new Date(review.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}
                      </p>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-700 italic mt-2.5">&ldquo;{review.comment}&rdquo;</p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-400">Waiting for customer review.</p>
                  </div>
                )}
              </div>
            </section>
          )}

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

                <div className="pt-4 border-t border-gray-100">
                  <PayMongoCheckout
                    bookingId={b.id}
                    paymentMethod={b.payment_method}
                    paymentStatus={b.payment_status}
                    checkoutUrl={paymongoCheckoutUrl}
                    paymentId={paymongoPaymentId}
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
              serviceLat={b.service_lat}
              serviceLng={b.service_lng}
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

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? 'text-yellow-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  )
}
