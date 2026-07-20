import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import { SortSelect } from '@/components/dashboard/sort-select'
import { SearchBox } from '@/components/dashboard/search-box'
import { Pagination } from '@/components/dashboard/pagination'
import { paginate, resolvePage } from '@/utils/pagination'
import { escapeLikeTerm } from '@/utils/search'

const PAGE_SIZE = 10

type Customer = {
  id: string
  full_name: string
  phone: string | null
  is_active: boolean
  created_at: string
}

const SORT_OPTIONS = [
  { value: 'name_asc',  label: 'Name (A → Z)' },
  { value: 'name_desc', label: 'Name (Z → A)' },
  { value: 'newest',    label: 'Newest First' },
  { value: 'oldest',    label: 'Oldest First' },
]

export default async function AdminCustomersPage({
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

  let customersQuery = supabase
    .from('profiles')
    .select('id, full_name, phone, is_active, created_at')
    .eq('role', 'customer')
    .order('full_name')
  const search = q?.trim()
  if (search) customersQuery = customersQuery.ilike('full_name', `%${escapeLikeTerm(search)}%`)
  const { data: customers } = await customersQuery

  const sortKey = sort ?? 'name_asc'
  const list = [...((customers ?? []) as unknown as Customer[])].sort((a, b) => {
    switch (sortKey) {
      case 'name_desc': return b.full_name.localeCompare(a.full_name)
      case 'newest':    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'oldest':    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      default:          return a.full_name.localeCompare(b.full_name)
    }
  })
  const active = list.filter((c) => c.is_active)
  const inactive = list.filter((c) => !c.is_active)

  const activePage = resolvePage(rawPage, active.length, PAGE_SIZE)
  const inactivePage = resolvePage(rawInactivePage, inactive.length, PAGE_SIZE)
  const activePageItems = paginate(active, activePage, PAGE_SIZE)
  const inactivePageItems = paginate(inactive, inactivePage, PAGE_SIZE)

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href={basePath || '/'} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Dashboard</Link>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <div className="flex items-center gap-3">
            <SearchBox placeholder="Search customers…" resetParams={['page', 'inactive_page']} />
            <SortSelect options={SORT_OPTIONS} />
            <span className="text-sm text-gray-400 whitespace-nowrap">{list.length} {search ? 'matching' : 'total'}</span>
          </div>
        </div>
      </div>

      <CustomerSection title="Active" customers={activePageItems} totalItems={active.length} basePath={basePath} emptyLabel={search ? 'No matches.' : 'None.'} />
      {inactive.length > 0 && (
        <CustomerSection
          title="Deactivated"
          customers={inactivePageItems}
          totalItems={inactive.length}
          basePath={basePath}
          paramName="inactive_page"
          emptyLabel={search ? 'No matches.' : 'None.'}
          dimmed
        />
      )}
    </div>
  )
}

function CustomerSection({
  title,
  customers,
  totalItems,
  basePath,
  paramName = 'page',
  dimmed = false,
  emptyLabel = 'None.',
}: {
  title: string
  customers: Customer[]
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
      {customers.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {customers.map((c) => (
            <Link
              key={c.id}
              href={`${basePath}/customers/${c.id}`}
              className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group ${dimmed ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  {c.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                  <p className="text-xs text-gray-400">{c.phone ?? 'No phone'}</p>
                </div>
              </div>
              <p className="text-xs text-pink-600 group-hover:underline">View →</p>
            </Link>
          ))}
        </div>
      )}
      <Pagination totalItems={totalItems} pageSize={PAGE_SIZE} paramName={paramName} />
    </section>
  )
}
