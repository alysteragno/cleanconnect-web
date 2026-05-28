import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { logout } from '@/app/actions/auth'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  branch_manager: 'Branch Manager',
  cleaner: 'Cleaner',
  customer: 'Customer',
}

const ROLE_HOME: Record<string, string> = {
  super_admin: '/admin',
  branch_manager: '/manager',
  cleaner: '/cleaner',
  customer: '/customer',
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'customer'
  const homeRoute = ROLE_HOME[role] ?? '/customer'

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-100">
          <a href={homeRoute} className="text-lg font-bold text-blue-600">
            CleanConnect
          </a>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <a
            href={homeRoute}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Dashboard
          </a>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <form action={logout}>
            <button
              type="submit"
              className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {ROLE_LABELS[role]}
          </span>
          <span className="text-sm font-medium text-gray-900">
            {profile?.full_name ?? user.email}
          </span>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
