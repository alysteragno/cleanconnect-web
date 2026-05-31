import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import CleanerEditForm from './cleaner-edit-form'
import AvailabilityPanel from './availability-panel'

type Cleaner = {
  id: string
  full_name: string
  phone: string | null
  is_active: boolean
  created_at: string
}

export default async function CleanerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: cleaner }, { count: jobsDone }, { data: dayOffRows }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone, is_active, created_at').eq('id', id).eq('role', 'cleaner').single(),
    supabase.from('cleaner_assignments').select('*', { count: 'exact', head: true }).eq('cleaner_id', id).eq('status', 'completed'),
    supabase.from('cleaner_availability').select('id, unavailable_date').eq('cleaner_id', id).order('unavailable_date'),
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
          <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-lg font-bold shrink-0">
            {c.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{c.full_name}</p>
            <p className="text-xs text-gray-500">{jobsDone ?? 0} jobs completed</p>
          </div>
        </div>

        <CleanerEditForm
          cleanerId={c.id}
          fullName={c.full_name}
          phone={c.phone}
          isActive={c.is_active}
        />
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
