import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'

type Cleaner = {
  id: string
  full_name: string
  phone: string | null
  is_active: boolean
  created_at: string
  photo_url: string | null
}

export default async function AdminCleanersPage() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const supabase = createAdminClient()

  const { data: cleaners } = await supabase
    .from('profiles')
    .select('id, full_name, phone, is_active, created_at, photo_url')
    .eq('role', 'cleaner')
    .order('full_name')

  const list = (cleaners ?? []) as unknown as Cleaner[]
  const active = list.filter((c) => c.is_active)
  const inactive = list.filter((c) => !c.is_active)

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Dashboard</Link>
        <div className="flex items-baseline justify-between mt-2">
          <h1 className="text-xl font-bold text-gray-900">Cleaners</h1>
          <Link
            href="/admin/cleaners/new"
            className="text-sm px-4 py-2 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition-colors"
          >
            + Add Cleaner
          </Link>
        </div>
      </div>

      <CleanerSection title="Active" cleaners={active} />
      {inactive.length > 0 && <CleanerSection title="Deactivated" cleaners={inactive} dimmed />}
    </div>
  )
}

function CleanerSection({ title, cleaners, dimmed = false }: { title: string; cleaners: Cleaner[]; dimmed?: boolean }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <span className="text-xs text-gray-400">{cleaners.length}</span>
      </div>
      {cleaners.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">None.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {cleaners.map((c) => (
            <Link
              key={c.id}
              href={`/admin/cleaners/${c.id}`}
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
    </section>
  )
}
