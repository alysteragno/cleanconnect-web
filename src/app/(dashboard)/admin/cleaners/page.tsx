import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import { SortSelect } from '@/components/dashboard/sort-select'
import { SearchBox } from '@/components/dashboard/search-box'
import { Pagination } from '@/components/dashboard/pagination'
import { paginate, resolvePage } from '@/utils/pagination'
import { escapeLikeTerm } from '@/utils/search'
import CleanersLocationMap, { type CleanerLocation } from './cleaners-location-map'

const PAGE_SIZE = 10

type Cleaner = {
  id: string
  full_name: string
  phone: string | null
  is_active: boolean
  created_at: string
  photo_url: string | null
  home_lat: number | null
  home_lng: number | null
  last_seen_lat: number | null
  last_seen_lng: number | null
  last_seen_at: string | null
}

const SORT_OPTIONS = [
  { value: 'name_asc',  label: 'Name (A → Z)' },
  { value: 'name_desc', label: 'Name (Z → A)' },
  { value: 'newest',    label: 'Newest First' },
  { value: 'oldest',    label: 'Oldest First' },
]

export default async function AdminCleanersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; page?: string; inactive_page?: string; q?: string }>
}) {
  const { sort, page: rawPage, inactive_page: rawInactivePage, q } = await searchParams
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const basePath = await getBasePath()
  const supabase = createAdminClient()

  let cleanersQuery = supabase
    .from('profiles')
    .select('id, full_name, phone, is_active, created_at, photo_url, home_lat, home_lng, last_seen_lat, last_seen_lng, last_seen_at')
    .eq('role', 'cleaner')
    .order('full_name')
  const search = q?.trim()
  if (search) cleanersQuery = cleanersQuery.ilike('full_name', `%${escapeLikeTerm(search)}%`)
  const { data: cleaners } = await cleanersQuery

  const sortKey = sort ?? 'name_asc'
  const list = [...((cleaners ?? []) as unknown as Cleaner[])].sort((a, b) => {
    switch (sortKey) {
      case 'name_desc': return b.full_name.localeCompare(a.full_name)
      case 'newest':    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'oldest':    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      default:          return a.full_name.localeCompare(b.full_name)
    }
  })
  const active = list.filter((c) => c.is_active)
  const inactive = list.filter((c) => !c.is_active)

  // One pin per active cleaner: their most recent "last seen" ping (opportunistic,
  // sent when the mobile app is foregrounded — not continuous tracking) when
  // available, else their admin-set home address as a fallback. Same source
  // chain the AI dispatcher uses (src/lib/ai-assignment.ts). Cleaners with
  // neither on file are left off the map.
  const cleanerLocations: CleanerLocation[] = active.reduce<CleanerLocation[]>((acc, c) => {
    if (c.last_seen_lat != null && c.last_seen_lng != null) {
      acc.push({ id: c.id, full_name: c.full_name, photo_url: c.photo_url, lat: c.last_seen_lat, lng: c.last_seen_lng, source: 'last_seen', lastSeenAt: c.last_seen_at })
    } else if (c.home_lat != null && c.home_lng != null) {
      acc.push({ id: c.id, full_name: c.full_name, photo_url: c.photo_url, lat: c.home_lat, lng: c.home_lng, source: 'home', lastSeenAt: null })
    }
    return acc
  }, [])

  const activePage = resolvePage(rawPage, active.length, PAGE_SIZE)
  const activePageItems = paginate(active, activePage, PAGE_SIZE)
  const inactivePage = resolvePage(rawInactivePage, inactive.length, PAGE_SIZE)
  const inactivePageItems = paginate(inactive, inactivePage, PAGE_SIZE)

  // Degrades to 0 (badge just stays hidden) if the resignation-requests
  // migration hasn't been applied yet — same graceful-fallback approach used
  // elsewhere in this file for is_active-adjacent features.
  const { count: pendingResignations } = await supabase
    .from('cleaner_resignation_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href={basePath || '/'} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Dashboard</Link>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
          <h1 className="text-xl font-bold text-gray-900">Cleaners</h1>
          <div className="flex items-center gap-3">
            <SearchBox placeholder="Search cleaners…" resetParams={['page', 'inactive_page']} />
            <SortSelect options={SORT_OPTIONS} />
            <Link
              href={`${basePath}/cleaners/new`}
              className="text-sm px-4 py-2 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition-colors whitespace-nowrap"
            >
              + Add Cleaner
            </Link>
          </div>
        </div>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Cleaner Locations</h2>
        <CleanersLocationMap cleaners={cleanerLocations} />
      </section>

      <CleanerSection title="Active" cleaners={activePageItems} totalItems={active.length} basePath={basePath} emptyLabel={search ? 'No matches.' : 'None.'} />

      {inactive.length > 0 && (
        <CleanerSection
          title="Deactivated"
          cleaners={inactivePageItems}
          totalItems={inactive.length}
          basePath={basePath}
          paramName="inactive_page"
          emptyLabel={search ? 'No matches.' : 'None.'}
          dimmed
        />
      )}

      <Link
        href={`${basePath}/cleaners/archive`}
        className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors group"
      >
        <div>
          <p className="text-sm font-semibold text-gray-900 group-hover:text-pink-600 transition-colors">Past Cleaners history</p>
          <p className="text-xs text-gray-400 mt-0.5">Jobs completed, joined & deactivated dates for every deactivated account</p>
        </div>
        <div className="flex items-center gap-2 text-gray-400 group-hover:text-pink-600 transition-colors">
          <span className="text-sm font-medium">{inactive.length}</span>
          <span aria-hidden>→</span>
        </div>
      </Link>

      <Link
        href={`${basePath}/resignation-requests`}
        className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors group"
      >
        <div>
          <p className="text-sm font-semibold text-gray-900 group-hover:text-pink-600 transition-colors">Resignation Requests</p>
          <p className="text-xs text-gray-400 mt-0.5">Review cleaners requesting to resign</p>
        </div>
        <div className="flex items-center gap-2 text-gray-400 group-hover:text-pink-600 transition-colors">
          {!!pendingResignations && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-semibold rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              {pendingResignations} pending
            </span>
          )}
          <span aria-hidden>→</span>
        </div>
      </Link>
    </div>
  )
}

function CleanerSection({
  title,
  cleaners,
  totalItems,
  basePath,
  paramName = 'page',
  dimmed = false,
  emptyLabel = 'None.',
}: {
  title: string
  cleaners: Cleaner[]
  totalItems: number
  basePath: string
  paramName?: string
  dimmed?: boolean
  emptyLabel?: string
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-200">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <span className="text-xs text-gray-400">{totalItems}</span>
      </div>
      {cleaners.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {cleaners.map((c) => (
            <Link
              key={c.id}
              href={`${basePath}/cleaners/${c.id}`}
              className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group ${dimmed ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-3">
                {c.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.photo_url}
                    alt={c.full_name}
                    className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                    {c.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                  <p className="text-xs text-gray-400">{c.phone ?? 'No phone'}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Pagination totalItems={totalItems} pageSize={PAGE_SIZE} paramName={paramName} />
    </section>
  )
}
