import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import ProfileForm from './profile-form'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, role')
    .eq('id', user.id)
    .single()

  const ROLE_LABELS: Record<string, string> = {
    customer: 'Customer',
    cleaner: 'Cleaner',
    branch_manager: 'Branch Manager',
    super_admin: 'Super Admin',
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link href="/customer" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Profile & Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account details.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-lg font-bold shrink-0">
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{profile?.full_name ?? '—'}</p>
            <p className="text-xs text-gray-500">
              {ROLE_LABELS[profile?.role ?? ''] ?? 'Customer'} · {user.email}
            </p>
          </div>
        </div>

        <ProfileForm
          fullName={profile?.full_name ?? ''}
          phone={profile?.phone ?? null}
          email={user.email ?? ''}
        />
      </div>
    </div>
  )
}
