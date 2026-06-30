import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import DayOffRequestForm from './day-off-form'
import DayOffRequestList from './day-off-list'

type DayOffRequest = {
  id: string
  requested_date: string
  reason: string | null
  notes: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  reviewed_at: string | null
  created_at: string
}

export default async function CleanerDayOffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'cleaner') redirect('/login')

  const { data: requests } = await supabase
    .from('cleaner_day_off_requests')
    .select('id, requested_date, reason, notes, status, admin_notes, reviewed_at, created_at')
    .eq('cleaner_id', user.id)
    .order('requested_date', { ascending: false })

  const rows = (requests ?? []) as DayOffRequest[]
  const today = new Date().toISOString().split('T')[0]
  const pending = rows.filter((r) => r.status === 'pending' && r.requested_date >= today)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Day-Off Requests</h1>
        <p className="mt-1 text-sm text-gray-500">
          Submit a day-off request and wait for admin approval. Approved dates will be blocked from bookings.
        </p>
      </div>

      {/* Pending alert */}
      {pending.length > 0 && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
          <span className="text-yellow-600 text-lg leading-none mt-0.5">⏳</span>
          <p className="text-sm text-yellow-800">
            You have <strong>{pending.length}</strong> pending request{pending.length !== 1 ? 's' : ''} awaiting approval.
          </p>
        </div>
      )}

      {/* Submit form */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">New Request</h2>
        <DayOffRequestForm />
      </section>

      {/* Request history */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Your Requests</h2>
        <DayOffRequestList requests={rows} />
      </section>

    </div>
  )
}
