import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import ComplaintThread from '@/components/dashboard/complaint-thread'
import ArchiveComplaintButton from './archive-button'
import ComplaintStatusControls from './status-controls'
import { formatTicketNumber } from '@/lib/complaint-ticket'

const STATUS_STYLES: Record<string, string> = {
  open:        'bg-yellow-50 text-yellow-700 border-yellow-200',
  in_progress: 'bg-pink-50 text-pink-700 border-pink-200',
  resolved:    'bg-green-50 text-green-700 border-green-200',
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
  if (profile?.role !== 'super_admin') notFound()

  const basePath = await getBasePath()
  const adminDb = createAdminClient()

  const [{ data: complaint }, { data: customerMsgs }] = await Promise.all([
    adminDb
      .from('complaints')
      .select('id, subject, status, created_at, customer_id, profiles!customer_id (full_name, phone)')
      .eq('id', id)
      .single(),
    adminDb
      .from('complaint_messages')
      .select('id, message, created_at, sender_id, profiles (full_name, role)')
      .eq('complaint_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!complaint) notFound()

  // Fetched separately so a missing column (migration not yet applied) degrades
  // gracefully to null instead of 404ing the page.
  const { data: archiveRow } = await adminDb
    .from('complaints')
    .select('archived_at')
    .eq('id', id)
    .maybeSingle()
  const isArchived = Boolean((archiveRow as { archived_at?: string | null } | null)?.archived_at)

  const { data: ticketRow } = await adminDb
    .from('complaints')
    .select('ticket_number')
    .eq('id', id)
    .maybeSingle()
  const ticketLabel = formatTicketNumber((ticketRow as { ticket_number?: number | null } | null)?.ticket_number ?? null)

  const { data: staffMsgs } = await adminDb
    .from('staff_complaint_messages')
    .select('id, message, created_at, sender_id')
    .eq('complaint_id', id)
    .order('created_at', { ascending: true })

  const messages = [
    ...(customerMsgs ?? []),
    ...(staffMsgs   ?? []),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  // A complaint may only be resolved once staff has actually replied.
  const hasStaffReply = (staffMsgs?.length ?? 0) > 0

  const profileData = Array.isArray(complaint.profiles) ? complaint.profiles[0] : complaint.profiles
  const customer    = profileData as { full_name: string; phone: string | null } | null
  const openedDate  = new Date(complaint.created_at).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
  })

  return (
    <div
      className="-m-4 sm:-m-6 flex flex-col overflow-hidden"
      style={{ height: 'calc(100vh - 3.5rem)' }}
    >
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link
          href={`${basePath}/complaints`}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M12 4L5 10l7 6" />
          </svg>
          <span className="hidden sm:inline">Back</span>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-semibold text-pink-600 bg-pink-50 border border-pink-100 rounded px-1.5 py-0.5 shrink-0">
              {ticketLabel}
            </span>
            <p className="text-sm font-semibold text-gray-900 truncate">{complaint.subject}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${STATUS_STYLES[complaint.status] ?? ''}`}>
              {complaint.status.replace('_', ' ')}
            </span>
            {isArchived && (
              <span className="text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 bg-gray-100 text-gray-500 border-gray-200">
                Archived
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {customer?.full_name ?? 'Unknown Customer'}
            {customer?.phone ? ` · ${customer.phone}` : ''} · Opened {openedDate}
          </p>
        </div>

        {/* Status controls */}
        <div className="flex items-center gap-1 shrink-0">
          <ComplaintStatusControls
            complaintId={id}
            currentStatus={complaint.status}
            hasStaffReply={hasStaffReply}
          />

          <div className="w-px h-5 bg-gray-200 mx-1" />
          <ArchiveComplaintButton complaintId={id} archived={isArchived} />
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <ComplaintThread
          complaintId={id}
          initialMessages={(messages ?? []) as never}
          currentUserId={user.id}
          currentUserRole={profile?.role ?? 'super_admin'}
          complaintStatus={complaint.status}
        />
      </div>
    </div>
  )
}
