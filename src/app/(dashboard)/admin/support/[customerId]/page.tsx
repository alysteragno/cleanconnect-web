import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import SupportThread from '@/components/dashboard/support-thread'
import { type ChatMessage } from '@/utils/chat-helpers'

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
      .select('full_name, phone')
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
          <p className="text-sm font-semibold text-gray-900 truncate">{customerProfile.full_name}</p>
          {customerProfile.phone && (
            <p className="text-xs text-gray-400 mt-0.5">{customerProfile.phone}</p>
          )}
        </div>

        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium shrink-0">
          Support
        </span>
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
