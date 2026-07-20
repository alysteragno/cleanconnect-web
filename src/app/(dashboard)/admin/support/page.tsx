import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import { SortSelect } from '@/components/dashboard/sort-select'
import { Pagination } from '@/components/dashboard/pagination'
import { paginate, resolvePage } from '@/utils/pagination'
import { isSupportConversationArchived, daysUntilSupportAutoArchive } from '@/utils/chat-helpers'
import NewChatButton from './new-chat-button'
import SupportConversationRow from './conversation-row'

const PAGE_SIZE = 10

function formatRelativeTime(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

const AVATAR_COLORS = [
  'bg-pink-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500',
  'bg-blue-500',  'bg-rose-500',  'bg-indigo-500', 'bg-teal-500',
]
function avatarColor(id: string) {
  let hash = 0
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const SORT_OPTIONS = [
  { value: 'recent',   label: 'Most Recent' },
  { value: 'oldest',   label: 'Oldest First' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc',label: 'Name Z–A' },
]

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; view?: string; page?: string }>
}) {
  const { sort, view, page: rawPage } = await searchParams
  const showArchived = view === 'archived'
  const supabase = await createClient()
  const adminDb  = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const basePath = await getBasePath()

  // A conversation can have messages from the customer (direct_messages),
  // staff (admin_messages), or both — a staff-initiated chat has no
  // direct_messages row until the customer replies, so both tables must be
  // read to know which customers have an active thread.
  const [{ data: customerMsgRows }, { data: staffMsgRows }] = await Promise.all([
    adminDb
      .from('direct_messages')
      .select('customer_id, message, created_at')
      .order('created_at', { ascending: false }),
    adminDb
      .from('admin_messages')
      .select('customer_id, message, created_at')
      .order('created_at', { ascending: false }),
  ])

  // Build last-message map: customerId → most recent message across both tables.
  const lastMsg = new Map<string, { message: string; created_at: string }>()
  for (const row of [...(customerMsgRows ?? []), ...(staffMsgRows ?? [])]) {
    const existing = lastMsg.get(row.customer_id)
    if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
      lastMsg.set(row.customer_id, row)
    }
  }

  const customerIds = [...lastMsg.keys()]

  if (customerIds.length === 0) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Support Chat</h1>
          <p className="text-sm text-gray-500 mt-0.5">No active conversations</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm text-gray-400 font-medium">No conversations yet</p>
            <p className="text-xs text-gray-300 mt-1">Conversations will appear here once a customer sends a message.</p>
          </div>
        </div>
      </div>
    )
  }

  const [{ data: customers }, archiveResult] = await Promise.all([
    adminDb
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', customerIds),
    // Degrades gracefully to "nothing manually archived" if the archive
    // migration hasn't been applied yet.
    adminDb
      .from('support_conversations')
      .select('customer_id, archived_at, restored_at')
      .in('customer_id', customerIds),
  ])

  const archiveState = new Map<string, { archived_at: string | null; restored_at: string | null }>()
  for (const row of archiveResult.data ?? []) archiveState.set(row.customer_id, row)

  const withArchiveFlag = (customers ?? []).map((c) => {
    const a = archiveState.get(c.id)
    const archivedAt    = a?.archived_at ?? null
    const restoredAt    = a?.restored_at ?? null
    const lastActivityAt = lastMsg.get(c.id)!.created_at
    const archived = isSupportConversationArchived({ archivedAt, restoredAt, lastActivityAt })
    const daysUntilArchive = daysUntilSupportAutoArchive({ archivedAt, restoredAt, lastActivityAt })
    return { ...c, archived, daysUntilArchive }
  })

  const active   = withArchiveFlag.filter((c) => !c.archived)
  const archived = withArchiveFlag.filter((c) => c.archived)
  const scoped   = showArchived ? archived : active

  // Sort based on selected option
  const sortKey = sort ?? 'recent'
  const sorted = [...scoped].sort((a, b) => {
    const aMsg = lastMsg.get(a.id)
    const bMsg = lastMsg.get(b.id)
    switch (sortKey) {
      case 'oldest':
        return new Date(aMsg!.created_at).getTime() - new Date(bMsg!.created_at).getTime()
      case 'name_asc':
        return a.full_name.localeCompare(b.full_name)
      case 'name_desc':
        return b.full_name.localeCompare(a.full_name)
      default: // recent
        return new Date(bMsg!.created_at).getTime() - new Date(aMsg!.created_at).getTime()
    }
  })

  const page = resolvePage(rawPage, sorted.length, PAGE_SIZE)
  const pageItems = paginate(sorted, page, PAGE_SIZE)

  const tabClass = (isActive: boolean) =>
    `text-sm font-medium pb-2 -mb-px border-b-2 transition-colors ${
      isActive
        ? 'border-pink-500 text-gray-900'
        : 'border-transparent text-gray-400 hover:text-gray-600'
    }`

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Support Chat</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {active.length} active {active.length === 1 ? 'conversation' : 'conversations'}
          </p>
        </div>
        <div className='flex items-center gap-4'>
          <NewChatButton />
          <SortSelect options={SORT_OPTIONS} />
        </div>
      </div>

      {/* Active / Archived tabs */}
      <div className="flex items-center gap-6 border-b border-gray-200">
        <Link href={`${basePath}/support`} className={tabClass(!showArchived)}>
          Active <span className="text-gray-300">({active.length})</span>
        </Link>
        <Link href={`${basePath}/support?view=archived`} className={tabClass(showArchived)}>
          Archived <span className="text-gray-300">({archived.length})</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {sorted.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-400 font-medium">
              {showArchived ? 'No archived conversations.' : 'No active conversations.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pageItems.map((c) => {
              const msg = lastMsg.get(c.id)!
              return (
                <SupportConversationRow
                  key={c.id}
                  customerId={c.id}
                  customerName={c.full_name}
                  avatarColorClass={avatarColor(c.id)}
                  initials={getInitials(c.full_name)}
                  lastMessage={msg.message}
                  relativeTime={formatRelativeTime(msg.created_at)}
                  daysUntilArchive={c.daysUntilArchive}
                  archived={c.archived}
                />
              )
            })}
          </div>
        )}
        <Pagination totalItems={sorted.length} pageSize={PAGE_SIZE} />
      </div>
    </div>
  )
}
