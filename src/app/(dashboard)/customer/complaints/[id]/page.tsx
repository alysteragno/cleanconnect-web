import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import ComplaintThread from '@/components/dashboard/complaint-thread'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
}
const STATUS_LABELS: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', resolved: 'Resolved',
}

export default async function CustomerComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const [{ data: complaint }, { data: messages }] = await Promise.all([
    supabase
      .from('complaints')
      .select('id, subject, status, created_at, booking_id')
      .eq('id', id)
      .eq('customer_id', user.id)
      .single(),
    supabase
      .from('complaint_messages')
      .select('id, message, created_at, sender_id, profiles (full_name, role)')
      .eq('complaint_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!complaint) notFound()

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <Link href="/customer/complaints" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Complaints
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-xl font-bold text-gray-900">{complaint.subject}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[complaint.status] ?? ''}`}>
            {STATUS_LABELS[complaint.status] ?? complaint.status}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          Filed {new Date(complaint.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      <ComplaintThread
        complaintId={id}
        initialMessages={(messages ?? []) as never}
        currentUserId={user.id}
        currentUserRole="customer"
        complaintStatus={complaint.status}
      />
    </div>
  )
}
