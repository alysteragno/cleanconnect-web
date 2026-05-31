import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import AvailabilityPanel from '@/app/(dashboard)/admin/cleaners/[id]/availability-panel'

type DayOff = { id: string; unavailable_date: string }

export default async function ManagerCleanerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: cleaner },
    { count: jobsDone },
    { count: jobsActive },
    { data: dayOffRows },
    { data: feedbackRows },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, phone, is_active, created_at')
      .eq('id', id)
      .eq('role', 'cleaner')
      .single(),
    supabase
      .from('cleaner_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('cleaner_id', id)
      .eq('status', 'completed'),
    supabase
      .from('cleaner_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('cleaner_id', id)
      .eq('status', 'accepted'),
    supabase
      .from('cleaner_availability')
      .select('id, unavailable_date')
      .eq('cleaner_id', id)
      .order('unavailable_date'),
    supabase
      .from('feedback')
      .select('rating')
      .eq('cleaner_id', id),
  ])

  if (!cleaner) notFound()

  const dayOffs = (dayOffRows ?? []) as DayOff[]
  const ratings = (feedbackRows ?? []) as { rating: number }[]
  const avgRating =
    ratings.length > 0
      ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
      : null

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link href="/manager/cleaners" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Cleaners
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Cleaner Detail</h1>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-lg font-bold shrink-0">
            {cleaner.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{cleaner.full_name}</p>
            <p className="text-xs text-gray-500">{cleaner.phone ?? 'No phone'}</p>
          </div>
          <span
            className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold border ${
              cleaner.is_active
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}
          >
            {cleaner.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold text-green-600">{jobsDone ?? 0}</p>
            <p className="text-xs text-gray-400">Jobs done</p>
          </div>
          <div>
            <p className="text-lg font-bold text-purple-600">{jobsActive ?? 0}</p>
            <p className="text-xs text-gray-400">Active jobs</p>
          </div>
          <div>
            {avgRating != null ? (
              <>
                <p className="text-lg font-bold text-yellow-500">★ {avgRating.toFixed(1)}</p>
                <p className="text-xs text-gray-400">{ratings.length} rating{ratings.length !== 1 ? 's' : ''}</p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-gray-300">—</p>
                <p className="text-xs text-gray-400">No ratings yet</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Availability override */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Availability Override</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Mark dates when this cleaner is unavailable. The AI dispatch will skip them on those days.
          </p>
        </div>
        <AvailabilityPanel cleanerId={cleaner.id} dayOffs={dayOffs} />
      </div>
    </div>
  )
}
