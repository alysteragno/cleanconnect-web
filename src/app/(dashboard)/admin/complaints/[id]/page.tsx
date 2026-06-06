import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import ComplaintThread from '@/components/dashboard/complaint-thread'
import { updateComplaintStatus } from '@/app/actions/complaints'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
]
const STATUS_STYLES: Record<string, string> = {
  open: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  in_progress: 'bg-pink-50 text-pink-700 border-pink-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
}

export default async function AdminComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  const [{ data: complaint }, { data: messages }] = await Promise.all([
    supabase
      .from('complaints')
      .select('id, subject, status, created_at, profiles (full_name, phone)')
      .eq('id', id)
      .single(),
    supabase
      .from('complaint_messages')
      .select('id, message, created_at, sender_id, profiles (full_name, role)')
      .eq('complaint_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!complaint) notFound()

  const profileData = Array.isArray(complaint.profiles) ? complaint.profiles[0] : complaint.profiles
  const customer = profileData as { full_name: string; phone: string | null } | null

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <Link href="/admin/complaints" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Complaints
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-xl font-bold text-gray-900">{complaint.subject}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[complaint.status] ?? ''}`}>
            {complaint.status.replace('_', ' ')}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          From {customer?.full_name ?? 'Customer'} ·{' '}
          {new Date(complaint.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Status control */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
        <span className="text-sm text-gray-600 font-medium shrink-0">Update status:</span>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <form key={opt.value} action={async () => { 'use server'; await updateComplaintStatus(id, opt.value) }}>
              <button
                type="submit"
                disabled={complaint.status === opt.value}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  complaint.status === opt.value
                    ? STATUS_STYLES[opt.value]
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {opt.label}
              </button>
            </form>
          ))}
        </div>
      </div>

      <ComplaintThread
        complaintId={id}
        initialMessages={(messages ?? []) as never}
        currentUserId={user.id}
        currentUserRole={profile?.role ?? 'super_admin'}
        complaintStatus={complaint.status}
      />
    </div>
  )
}
