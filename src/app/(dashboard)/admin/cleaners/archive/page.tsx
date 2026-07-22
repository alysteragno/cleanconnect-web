import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import { SearchBox } from '@/components/dashboard/search-box'
import { Pagination } from '@/components/dashboard/pagination'
import { paginate, resolvePage } from '@/utils/pagination'
import { escapeLikeTerm } from '@/utils/search'
import ReactivateButton from './reactivate-button'

const PAGE_SIZE = 15

type PastCleaner = {
  id: string
  full_name: string
  phone: string | null
  photo_url: string | null
  created_at: string
  deactivated_at: string | null
}

function formatDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function CleanersArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const { page: rawPage, q } = await searchParams
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const basePath = await getBasePath()
  const supabase = createAdminClient()

  let query = supabase
    .from('profiles')
    .select('id, full_name, phone, photo_url, created_at, deactivated_at')
    .eq('role', 'cleaner')
    .eq('is_active', false)
    .order('deactivated_at', { ascending: false, nullsFirst: false })
  const search = q?.trim()
  if (search) query = query.ilike('full_name', `%${escapeLikeTerm(search)}%`)
  const { data: rows } = await query

  const cleaners = (rows ?? []) as unknown as PastCleaner[]

  // Total completed jobs per past cleaner, for a quick sense of tenure/history
  // alongside the deactivation date.
  const ids = cleaners.map((c) => c.id)
  const jobsByCleanerId = new Map<string, number>()
  if (ids.length > 0) {
    const { data: assignments } = await supabase
      .from('cleaner_assignments')
      .select('cleaner_id')
      .eq('status', 'completed')
      .in('cleaner_id', ids)
    for (const a of (assignments ?? []) as { cleaner_id: string }[]) {
      jobsByCleanerId.set(a.cleaner_id, (jobsByCleanerId.get(a.cleaner_id) ?? 0) + 1)
    }
  }

  const page = resolvePage(rawPage, cleaners.length, PAGE_SIZE)
  const pageItems = paginate(cleaners, page, PAGE_SIZE)

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href={`${basePath}/cleaners`} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Cleaners</Link>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Past Cleaners</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Deactivated cleaner accounts and their history. Reactivate to restore login and dispatch eligibility.
            </p>
          </div>
          <SearchBox placeholder="Search past cleaners…" resetParams={['page']} />
        </div>
      </div>

      <section className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Deactivated</h2>
          <span className="text-xs text-gray-400">{cleaners.length}</span>
        </div>
        {pageItems.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">
            {search ? 'No matches.' : 'No past cleaners — every cleaner account is currently active.'}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {pageItems.map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between gap-4 opacity-90">
                <Link href={`${basePath}/cleaners/${c.id}`} className="flex items-center gap-3 min-w-0 group">
                  {c.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.photo_url}
                      alt={c.full_name}
                      className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0 grayscale"
                    />
                  ) : (
                    <div className="w-9 h-9 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                      {c.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate group-hover:underline">{c.full_name}</p>
                    <p className="text-xs text-gray-400">{c.phone ?? 'No phone'}</p>
                  </div>
                </Link>

                <div className="hidden sm:flex flex-col items-end text-xs text-gray-400 shrink-0">
                  <span>{jobsByCleanerId.get(c.id) ?? 0} jobs completed</span>
                  <span>Joined {formatDateTime(c.created_at)}</span>
                  <span>Deactivated {formatDateTime(c.deactivated_at)}</span>
                </div>

                <div className="shrink-0 w-[110px]">
                  <ReactivateButton cleanerId={c.id} />
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination totalItems={cleaners.length} pageSize={PAGE_SIZE} paramName="page" />
      </section>
    </div>
  )
}
