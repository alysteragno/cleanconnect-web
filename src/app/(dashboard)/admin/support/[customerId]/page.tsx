import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import SupportThread from '@/components/dashboard/support-thread'
import { type ChatMessage, isSupportConversationArchived, daysUntilSupportAutoArchive } from '@/utils/chat-helpers'
import ArchiveSupportButton from '../archive-button'

export default async function AdminSupportThreadPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = await params
  const supabase = await createClient()
  const adminDb  = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const basePath = await getBasePath()

  const [{ data: customerProfile }, { data: customerMsgs }, { data: adminMsgs }] = await Promise.all([
    adminDb
      .from('profiles')
      .select('full_name, phone, created_at')
      .eq('id', customerId)
      .single(),
    // Customer → staff messages
    adminDb
      .from('direct_messages')
      .select('id, message, created_at, sender_id')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true }),
    // Staff → customer replies
    adminDb
      .from('admin_messages')
      .select('id, message, created_at, sender_id')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true }),
  ])

  if (!customerProfile) notFound()

  const messages = [
    ...(customerMsgs ?? []),
    ...(adminMsgs    ?? []),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  // Fetched separately so a missing table (migration not yet applied)
  // degrades gracefully to "not manually archived" instead of erroring.
  const { data: archiveRow } = await adminDb
    .from('support_conversations')
    .select('archived_at, restored_at')
    .eq('customer_id', customerId)
    .maybeSingle()

  const lastActivityAt = messages[messages.length - 1]?.created_at ?? customerProfile.created_at
  const archivedAt = archiveRow?.archived_at ?? null
  const restoredAt = archiveRow?.restored_at ?? null
  const isArchived = isSupportConversationArchived({ archivedAt, restoredAt, lastActivityAt })
  const daysUntilArchive = daysUntilSupportAutoArchive({ archivedAt, restoredAt, lastActivityAt })

  return (
    <div
      className="-m-4 sm:-m-6 flex flex-col overflow-hidden"
      style={{ height: 'calc(100vh - 3.5rem)' }}
    >
      {/* Thread header */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link
          href={`${basePath}/support`}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M12 4L5 10l7 6" />
          </svg>
          <span className="hidden sm:inline">Back</span>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">{customerProfile.full_name}</p>
            {isArchived && (
              <span className="text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 bg-gray-100 text-gray-500 border-gray-200">
                Archived
              </span>
            )}
          </div>
          {customerProfile.phone && (
            <p className="text-xs text-gray-400 mt-0.5">{customerProfile.phone}</p>
          )}
          {!isArchived && daysUntilArchive !== null && (
            <p className={`text-xs mt-0.5 ${daysUntilArchive <= 3 ? 'text-amber-500' : 'text-gray-300'}`}>
              Auto-archives in {daysUntilArchive <= 1 ? '1 day' : `${daysUntilArchive} days`} of inactivity
            </p>
          )}
        </div>

        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium shrink-0">
          Support
        </span>

        <ArchiveSupportButton customerId={customerId} archived={isArchived} />
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-hidden min-h-0">
        <SupportThread
          customerId={customerId}
          initialMessages={messages as unknown as ChatMessage[]}
          currentUserId={user.id}
          isStaff={true}
        />
      </div>
    </div>
  )
}
