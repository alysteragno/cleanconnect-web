import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import { getUpcomingAssignedJobCount } from '@/lib/cleaner-jobs'
import { Pagination } from '@/components/dashboard/pagination'
import { paginate, resolvePage } from '@/utils/pagination'
import CleanerEditForm, { type Cleaner } from './cleaner-edit-form'
import CleanerToggleForm from './cleaner-toggle-form'
import DeleteCleanerButton from './delete-cleaner-button'
import AvailabilityPanel from './availability-panel'

const JOBS_PAGE_SIZE = 10

const PAYMENT_STYLES: Record<string, string> = {
  unpaid:   'bg-red-50 text-red-600 border-red-200',
  partial:  'bg-amber-50 text-amber-600 border-amber-200',
  paid:     'bg-emerald-50 text-emerald-600 border-emerald-200',
  refunded: 'bg-gray-50 text-gray-500 border-gray-200',
}

function formatJobDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatJobTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

type CompletedJob = {
  id: string
  service_date: string
  service_time: string
  service_name: string | null
  base_price: number
  payment_status: string
  customerName: string | null
  rating: number | null
}

// Two-step fetch (cleaner_assignments → bookings → feedback) because
// PostgREST can't filter a nested bookings/feedback join on the middle
// table's cleaner_id in one call — same pattern as getUpcomingAssignedJobCount
// in src/lib/cleaner-jobs.ts, just for 'completed' assignments instead of upcoming ones.
async function getCompletedJobs(adminDb: ReturnType<typeof createAdminClient>, cleanerId: string): Promise<CompletedJob[]> {
  const { data: assignments } = await adminDb
    .from('cleaner_assignments')
    .select('booking_id')
    .eq('cleaner_id', cleanerId)
    .eq('status', 'completed')

  const bookingIds = [...new Set((assignments ?? []).map((a) => a.booking_id))]
  if (bookingIds.length === 0) return []

  const [{ data: bookingRows }, { data: feedbackRows }] = await Promise.all([
    adminDb
      .from('bookings')
      .select('id, service_date, service_time, service_name, base_price, payment_status, profiles!customer_id (full_name)')
      .in('id', bookingIds),
    adminDb
      .from('feedback')
      .select('booking_id, rating')
      .eq('cleaner_id', cleanerId)
      .in('booking_id', bookingIds),
  ])

  const ratingMap = new Map((feedbackRows ?? []).map((f) => [f.booking_id, f.rating as number]))

  type BookingRow = {
    id: string; service_date: string; service_time: string; service_name: string | null
    base_price: number; payment_status: string; profiles: { full_name: string } | null
  }

  return ((bookingRows ?? []) as unknown as BookingRow[])
    .map((b) => ({
      id: b.id,
      service_date: b.service_date,
      service_time: b.service_time,
      service_name: b.service_name,
      base_price: b.base_price,
      payment_status: b.payment_status,
      customerName: b.profiles?.full_name ?? null,
      rating: ratingMap.get(b.id) ?? null,
    }))
    .sort((a, b) => {
      const dateDiff = b.service_date.localeCompare(a.service_date)
      return dateDiff !== 0 ? dateDiff : b.service_time.localeCompare(a.service_time)
    })
}

export default async function CleanerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { id } = await params
  const { page: rawPage } = await searchParams
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const basePath = await getBasePath()
  const adminDb = createAdminClient()

  const [
    { data: cleaner },
    { count: jobsDone },
    { data: dayOffRows },
    upcomingJobCount,
    completedJobs,
  ] = await Promise.all([
    adminDb.from('profiles').select('id, full_name, phone, is_active, deactivated_at, created_at, address_street, address_city, address_province, date_of_birth, emergency_contact_name, emergency_contact_phone, home_lat, home_lng, photo_url').eq('id', id).eq('role', 'cleaner').single(),
    adminDb.from('cleaner_assignments').select('*', { count: 'exact', head: true }).eq('cleaner_id', id).eq('status', 'completed'),
    adminDb.from('cleaner_availability').select('id, unavailable_date').eq('cleaner_id', id).order('unavailable_date'),
    getUpcomingAssignedJobCount(adminDb, id),
    getCompletedJobs(adminDb, id),
  ])

  if (!cleaner) notFound()

  const c = cleaner as unknown as Cleaner
  const deactivatedAt = (cleaner as unknown as { deactivated_at: string | null }).deactivated_at
  const dayOffs = (dayOffRows ?? []) as { id: string; unavailable_date: string }[]

  const jobsPage = resolvePage(rawPage, completedJobs.length, JOBS_PAGE_SIZE)
  const jobsPageItems = paginate(completedJobs, jobsPage, JOBS_PAGE_SIZE)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`${basePath}/cleaners`} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Cleaners</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Edit Cleaner</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100">
          {c.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.photo_url}
              alt={c.full_name}
              className="w-12 h-12 rounded-full object-cover border border-gray-200 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-lg font-bold shrink-0">
              {c.full_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-base font-semibold text-gray-900">{c.full_name}</p>
            <p className="text-xs text-gray-500">{jobsDone ?? 0} jobs completed</p>
          </div>
        </div>

        <CleanerEditForm cleaner={c} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Account Status</p>
          <CleanerToggleForm
            cleanerId={c.id}
            isActive={c.is_active}
            deactivatedAt={deactivatedAt}
            upcomingJobCount={upcomingJobCount}
            bookingsHref={`${basePath}/bookings`}
          />
        </div>

        <div className="pt-4 border-t border-gray-100">
          <DeleteCleanerButton cleanerId={c.id} />
        </div>
      </div>

      {/* Jobs Performed History */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Jobs Performed History
          </p>
        </div>

        {completedJobs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No completed jobs yet.</p>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[100px_1fr_1fr_100px_80px_60px] gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50/60">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Service</p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Amount</p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Payment</p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Rating</p>
            </div>

            <div className="hidden sm:block divide-y divide-gray-50">
              {jobsPageItems.map((j) => (
                <div key={j.id} className="grid grid-cols-[100px_1fr_1fr_100px_80px_60px] gap-4 items-center px-6 py-3.5">
                  <div>
                    <p className="text-xs text-gray-600">{formatJobDate(j.service_date)}</p>
                    <p className="text-[11px] text-gray-400">{formatJobTime(j.service_time)}</p>
                  </div>
                  <p className="text-sm text-gray-800 truncate">{j.service_name ?? '—'}</p>
                  <p className="text-sm text-gray-700 truncate">{j.customerName ?? '—'}</p>
                  <p className="text-sm font-semibold text-gray-900 text-right">₱{Number(j.base_price).toLocaleString()}</p>
                  <div className="flex justify-end">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${PAYMENT_STYLES[j.payment_status] ?? ''}`}>
                      {j.payment_status}
                    </span>
                  </div>
                  <p className="text-sm text-right text-gray-700">
                    {j.rating != null ? <>★ {j.rating}</> : <span className="text-gray-300">—</span>}
                  </p>
                </div>
              ))}
            </div>

            {/* Mobile */}
            <div className="sm:hidden divide-y divide-gray-50">
              {jobsPageItems.map((j) => (
                <div key={j.id + '-m'} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{j.customerName ?? '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {j.service_name ?? '—'} · {formatJobDate(j.service_date)}, {formatJobTime(j.service_time)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className="text-sm font-bold text-gray-900">₱{Number(j.base_price).toLocaleString()}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${PAYMENT_STYLES[j.payment_status] ?? ''}`}>
                        {j.payment_status}
                      </span>
                    </div>
                  </div>
                  {j.rating != null && (
                    <p className="text-xs text-gray-500 mt-1.5">★ {j.rating} rating</p>
                  )}
                </div>
              ))}
            </div>

            <Pagination totalItems={completedJobs.length} pageSize={JOBS_PAGE_SIZE} />
          </>
        )}
      </div>
    </div>
  )
}
