import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'

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

export default async function AdminSupportPage() {
  const supabase = await createClient()
  const adminDb  = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const [{ data: customers }, { data: msgRows }] = await Promise.all([
    // Admin client bypasses RLS to list all customers reliably
    adminDb
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'customer')
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('direct_messages')
      .select('customer_id, message, created_at')
      .order('created_at', { ascending: false }),
  ])

  // Build last-message map: customerId → most recent message
  const lastMsg = new Map<string, { message: string; created_at: string }>()
  for (const row of msgRows ?? []) {
    if (!lastMsg.has(row.customer_id)) lastMsg.set(row.customer_id, row)
  }

  // Sort: conversations with messages first (newest first), then remaining customers
  const sorted = [...(customers ?? [])].sort((a, b) => {
    const aMsg = lastMsg.get(a.id)
    const bMsg = lastMsg.get(b.id)
    if (aMsg && bMsg) return new Date(bMsg.created_at).getTime() - new Date(aMsg.created_at).getTime()
    if (aMsg) return -1
    if (bMsg) return 1
    return a.full_name.localeCompare(b.full_name)
  })

  const activeCount = lastMsg.size

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Support Chat</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {sorted.length} {sorted.length === 1 ? 'customer' : 'customers'} &mdash; {activeCount} active {activeCount === 1 ? 'conversation' : 'conversations'}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {sorted.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-400 font-medium">No customers yet.</p>
            <p className="text-xs text-gray-300 mt-1">Customers will appear here once registered.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sorted.map((c) => {
              const msg = lastMsg.get(c.id)
              return (
                <Link
                  key={c.id}
                  href={`/admin/support/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors group"
                >
                  <div className={`w-9 h-9 rounded-full ${avatarColor(c.id)} text-white flex items-center justify-center text-xs font-bold shrink-0 select-none`}>
                    {getInitials(c.full_name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{c.full_name}</p>
                    {msg ? (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{msg.message}</p>
                    ) : (
                      <p className="text-xs text-gray-300 mt-0.5 italic">No messages yet</p>
                    )}
                  </div>

                  <div className="text-right shrink-0 ml-2 flex flex-col items-end gap-1">
                    {msg ? (
                      <p className="text-xs text-gray-400">{formatRelativeTime(msg.created_at)}</p>
                    ) : (
                      <span className="text-[10px] text-gray-300 border border-gray-200 rounded-full px-2 py-0.5">
                        New
                      </span>
                    )}
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
        )}
      </div>
    </div>
  )
}
