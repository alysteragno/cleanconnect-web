import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import CleanerProfileForm from './profile-form'

export default async function CleanerProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, branch_id, branches (name)')
    .eq('id', user.id)
    .single()

  const p = profile as unknown as {
    full_name: string
    phone: string | null
    branches: { name: string } | null
  } | null

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link href="/cleaner" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Profile</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-lg font-bold shrink-0">
            {p?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{p?.full_name ?? '—'}</p>
            <p className="text-xs text-gray-500">
              Cleaner · {p?.branches?.name ?? 'No branch assigned'} · {user.email}
            </p>
          </div>
        </div>

        <CleanerProfileForm
          fullName={p?.full_name ?? ''}
          phone={p?.phone ?? null}
          email={user.email ?? ''}
        />
      </div>
    </div>
  )
}
