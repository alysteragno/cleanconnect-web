import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import ComplaintRow from './complaint-row'
import NewChatButton from './new-chat-button'
import { SortSelect } from '@/components/dashboard/sort-select'
import { Pagination } from '@/components/dashboard/pagination'
import { paginate, resolvePage } from '@/utils/pagination'

const PAGE_SIZE = 10

const SORT_OPTIONS = [
  { value: 'newest',    label: 'Newest First' },
  { value: 'oldest',    label: 'Oldest First' },
  { value: 'name_asc',  label: 'Customer A–Z' },
  { value: 'name_desc', label: 'Customer Z–A' },
]

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  in_progress: 'bg-pink-50 text-pink-700 border-pink-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
}
const STATUS_LABELS: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', resolved: 'Resolved',
}

type ComplaintRecord = {
  id: string
  subject: string
  status: string
  created_at: string
  archived_at: string | null
  profiles: { full_name: string } | { full_name: string }[] | null
}

export default async function AdminComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; sort?: string; page?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const basePath = await getBasePath()
  const { view, sort, page: rawPage } = await searchParams
  const showArchived = view === 'archived'

  const adminDb = createAdminClient()

  // Try selecting archived_at; if the migration has not been applied yet, fall
  // back to a query without it and treat every complaint as active.
  const primary = await adminDb
    .from('complaints')
    .select('id, subject, status, created_at, archived_at, profiles!customer_id (full_name)')
    .order('created_at', { ascending: false })

  let rows: ComplaintRecord[]
  if (primary.error) {
    const fb = await adminDb
      .from('complaints')
      .select('id, subject, status, created_at, profiles!customer_id (full_name)')
      .order('created_at', { ascending: false })
    rows = (fb.data ?? []).map((r) => ({ ...r, archived_at: null })) as ComplaintRecord[]
  } else {
    rows = (primary.data ?? []) as ComplaintRecord[]
  }

  const nameOf = (c: ComplaintRecord) =>
    ((Array.isArray(c.profiles) ? c.profiles[0] : c.profiles) as { full_name: string } | null)?.full_name ?? 'Customer'

  const active = rows.filter((c) => !c.archived_at)
  const archived = rows.filter((c) => c.archived_at)
  const scoped = showArchived ? archived : active
  const openCount = active.filter((c) => c.status !== 'resolved').length

  const sortKey = sort ?? 'newest'
  const list = [...scoped].sort((a, b) => {
    switch (sortKey) {
      case 'oldest':    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'name_asc':  return nameOf(a).localeCompare(nameOf(b))
      case 'name_desc': return nameOf(b).localeCompare(nameOf(a))
      default:          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
  })

  const page = resolvePage(rawPage, list.length, PAGE_SIZE)
  const pageItems = paginate(list, page, PAGE_SIZE)

  const tabClass = (isActive: boolean) =>
    `text-sm font-medium pb-2 -mb-px border-b-2 transition-colors ${
      isActive
        ? 'border-pink-500 text-gray-900'
        : 'border-transparent text-gray-400 hover:text-gray-600'
    }`

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Complaints</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {openCount} open · {active.length} active
          </p>
        </div>
        <SortSelect options={SORT_OPTIONS} />
      </div>

      {/* Active / Archived tabs */}
      <div className="flex items-center gap-6 border-b border-gray-200">
        <Link href={`${basePath}/complaints`} className={tabClass(!showArchived)}>
          Active <span className="text-gray-300">({active.length})</span>
        </Link>
        <Link href={`${basePath}/complaints?view=archived`} className={tabClass(showArchived)}>
          Archived <span className="text-gray-300">({archived.length})</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {list.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400">
              {showArchived ? 'No archived complaints.' : 'No active complaints.'}
            </p>
          </div>
        ) : (
          pageItems.map((c) => (
            <ComplaintRow
              key={c.id}
              complaintId={c.id}
              subject={c.subject}
              customerName={nameOf(c)}
              dateLabel={new Date(c.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}
              statusLabel={STATUS_LABELS[c.status] ?? c.status}
              statusClass={STATUS_STYLES[c.status] ?? ''}
              archived={Boolean(c.archived_at)}
            />
          ))
        )}
        {list.length > 0 && <Pagination totalItems={list.length} pageSize={PAGE_SIZE} />}
      </div>
    </div>
  )
}
