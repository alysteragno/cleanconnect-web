import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import CleanerEditForm, { type Cleaner } from './cleaner-edit-form'
import AvailabilityPanel from './availability-panel'
import DayOffReviewPanel from './day-off-review-panel'

type UpcomingAssignment = {
  booking_id: string
  status: string
  bookings: {
    service_date: string
    service_time: string
    service_name: string | null
    status: string
    address_city: string | null
  } | null
}

const BOOKING_STATUS_STYLES: Record<string, string> = {
  confirmed:   'bg-pink-50 text-pink-700 border-pink-200',
  in_progress: 'bg-purple-50 text-purple-700 border-purple-200',
  pending:     'bg-yellow-50 text-yellow-700 border-yellow-200',
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

export default async function CleanerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { data: cleaner },
    { count: jobsDone },
    { data: dayOffRows },
    { data: upcomingRows },
    { data: pendingRequestRows },
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone, is_active, created_at, address_street, address_city, address_province, date_of_birth, emergency_contact_name, emergency_contact_phone, home_lat, home_lng').eq('id', id).eq('role', 'cleaner').single(),
    supabase.from('cleaner_assignments').select('*', { count: 'exact', head: true }).eq('cleaner_id', id).eq('status', 'completed'),
    supabase.from('cleaner_availability').select('id, unavailable_date').eq('cleaner_id', id).order('unavailable_date'),
    supabase
      .from('cleaner_assignments')
      .select('booking_id, status, bookings!booking_id (service_date, service_time, service_name, status, address_city)')
      .eq('cleaner_id', id)
      .in('status', ['assigned'])
      .gte('bookings.service_date', today)
      .order('bookings.service_date', { ascending: true })
      .limit(10),
    supabase
      .from('cleaner_day_off_requests')
      .select('id, requested_date, reason, created_at')
      .eq('cleaner_id', id)
      .eq('status', 'pending')
      .gte('requested_date', today)
      .order('requested_date', { ascending: true }),
  ])

  if (!cleaner) notFound()

  const c = cleaner as unknown as Cleaner
  const dayOffs = (dayOffRows ?? []) as { id: string; unavailable_date: string }[]
  const upcoming = (upcomingRows ?? []) as unknown as UpcomingAssignment[]
  const activeSchedule = upcoming.filter((a) => a.bookings != null)
  const pendingRequests = (pendingRequestRows ?? []) as {
    id: string; requested_date: string; reason: string | null; created_at: string
  }[]

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/cleaners" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Cleaners</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Edit Cleaner</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100">
          <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-lg font-bold shrink-0">
            {c.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{c.full_name}</p>
            <p className="text-xs text-gray-500">{jobsDone ?? 0} jobs completed</p>
          </div>
        </div>

        <CleanerEditForm cleaner={c} />
      </div>

      {/* Assigned Schedule */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Assigned Schedule</p>
          <p className="text-xs text-gray-500 mt-0.5">Upcoming bookings this cleaner has been assigned to.</p>
        </div>
        {activeSchedule.length === 0 ? (
          <p className="text-sm text-gray-400">No upcoming assignments.</p>
        ) : (
          <div className="space-y-2">
            {activeSchedule.map((a) => (
              <Link
                key={a.booking_id}
                href={`/admin/bookings/${a.booking_id}`}
                className="flex items-center justify-between px-4 py-3 border border-gray-100 rounded-lg hover:border-pink-200 hover:bg-pink-50/40 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-pink-700 transition-colors">
                    {a.bookings!.service_name ?? 'Cleaning'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(a.bookings!.service_date)} at {formatTime(a.bookings!.service_time)}
                    {a.bookings!.address_city && ` · ${a.bookings!.address_city}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${BOOKING_STATUS_STYLES[a.bookings!.status] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {a.bookings!.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full border font-medium capitalize bg-blue-50 text-blue-700 border-blue-200">
                    {a.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pending Day-Off Requests */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Day-Off Requests</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Pending requests submitted by this cleaner.
            </p>
          </div>
          {pendingRequests.length > 0 && (
            <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full font-medium">
              {pendingRequests.length} pending
            </span>
          )}
        </div>
        <DayOffReviewPanel requests={pendingRequests} />
      </div>

      {/* Availability Management */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Availability Override</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Mark dates when this cleaner is unavailable. The AI dispatch will skip them on those days.
          </p>
        </div>
        <AvailabilityPanel cleanerId={c.id} dayOffs={dayOffs} />
      </div>
    </div>
  )
}
