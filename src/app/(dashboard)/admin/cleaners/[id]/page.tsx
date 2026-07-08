import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import CleanerEditForm, { type Cleaner } from './cleaner-edit-form'
import AvailabilityPanel from './availability-panel'

export default async function CleanerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const adminDb = createAdminClient()

  const [
    { data: cleaner },
    { count: jobsDone },
    { data: dayOffRows },
  ] = await Promise.all([
    adminDb.from('profiles').select('id, full_name, phone, is_active, created_at, address_street, address_city, address_province, date_of_birth, emergency_contact_name, emergency_contact_phone, home_lat, home_lng, photo_url').eq('id', id).eq('role', 'cleaner').single(),
    adminDb.from('cleaner_assignments').select('*', { count: 'exact', head: true }).eq('cleaner_id', id).eq('status', 'completed'),
    adminDb.from('cleaner_availability').select('id, unavailable_date').eq('cleaner_id', id).order('unavailable_date'),
  ])

  if (!cleaner) notFound()

  const c = cleaner as unknown as Cleaner
  const dayOffs = (dayOffRows ?? []) as { id: string; unavailable_date: string }[]

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/cleaners" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Cleaners</Link>
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
