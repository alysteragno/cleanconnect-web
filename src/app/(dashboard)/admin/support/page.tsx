import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import { SortSelect } from '@/components/dashboard/sort-select'

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
  searchParams: Promise<{ sort?: string }>
}) {
  const { sort } = await searchParams
  const supabase = await createClient()
  const adminDb  = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const basePath = await getBasePath()

  // Fetch only customer messages (direct_messages are sent by customers)
  const { data: msgRows } = await supabase
    .from('direct_messages')
    .select('customer_id, message, created_at')
    .order('created_at', { ascending: false })

  // Build last-message map: customerId → most recent message
  const lastMsg = new Map<string, { message: string; created_at: string }>()
  for (const row of msgRows ?? []) {
    if (!lastMsg.has(row.customer_id)) lastMsg.set(row.customer_id, row)
  }

  // Only fetch customers who have actually sent messages
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

  const { data: customers } = await adminDb
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', customerIds)

  // Sort based on selected option
  const sortKey = sort ?? 'recent'
  const sorted = [...(customers ?? [])].sort((a, b) => {
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

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Support Chat</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {sorted.length} active {sorted.length === 1 ? 'conversation' : 'conversations'}
          </p>
        </div>
        <SortSelect options={SORT_OPTIONS} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="divide-y divide-gray-100">
          {sorted.map((c) => {
            const msg = lastMsg.get(c.id)!
            return (
              <Link
                key={c.id}
                href={`${basePath}/support/${c.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors group"
              >
                <div className={`w-9 h-9 rounded-full ${avatarColor(c.id)} text-white flex items-center justify-center text-xs font-bold shrink-0 select-none`}>
                  {getInitials(c.full_name)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{c.full_name}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{msg.message}</p>
                </div>

                <div className="text-right shrink-0 ml-2 flex flex-col items-end gap-1">
                  <p className="text-xs text-gray-400">{formatRelativeTime(msg.created_at)}</p>
                  <svg
                    width="13" height="13" viewBox="0 0 16 16" fill="none"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                    className="text-gray-300 group-hover:text-pink-500 transition-colors"
                  >
                    <path d="M6 3l5 5-5 5" />
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
