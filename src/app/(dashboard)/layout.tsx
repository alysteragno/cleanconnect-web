import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { logout } from '@/app/actions/auth'
import NotificationBell from '@/components/dashboard/notification-bell'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  branch_manager: 'Branch Manager',
  cleaner: 'Cleaner',
  customer: 'Customer',
}

const ROLE_NAV: Record<string, { href: string; label: string; icon: string }[]> = {
  customer: [
    { href: '/customer', label: 'Dashboard', icon: '🏠' },
    { href: '/customer/book', label: 'Book a Service', icon: '📋' },
    { href: '/customer/bookings', label: 'My Bookings', icon: '📅' },
    { href: '/customer/profile', label: 'Profile', icon: '👤' },
    { href: '/customer/complaints', label: 'Complaints', icon: '🗣️' },
    { href: '/customer/help', label: 'Help & Support', icon: '💬' },
  ],
  cleaner: [
    { href: '/cleaner', label: 'Dashboard', icon: '🏠' },
    { href: '/cleaner/jobs', label: 'My Jobs', icon: '📋' },
    { href: '/cleaner/schedule', label: 'Schedule', icon: '📅' },
    { href: '/cleaner/profile', label: 'Profile', icon: '👤' },
  ],
  branch_manager: [
    { href: '/manager', label: 'Dashboard', icon: '🏠' },
    { href: '/manager/bookings', label: 'Bookings', icon: '📋' },
    { href: '/manager/cleaners', label: 'Cleaners', icon: '👷' },
  ],
  super_admin: [
    { href: '/admin', label: 'Dashboard', icon: '🏠' },
    { href: '/admin/bookings', label: 'All Bookings', icon: '📋' },
    { href: '/admin/cleaners', label: 'Cleaners', icon: '👷' },
    { href: '/admin/branches', label: 'Branches', icon: '🏢' },
    { href: '/admin/feedback', label: 'Feedback', icon: '⭐' },
    { href: '/admin/complaints', label: 'Complaints', icon: '🗣️' },
    { href: '/admin/reports', label: 'Reports', icon: '📊' },
    { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
  ],
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
  const navLinks = ROLE_NAV[role] ?? ROLE_NAV.customer
  const displayName = profile?.full_name ?? user.email ?? 'User'
  const initials = displayName.charAt(0).toUpperCase()

  const { data: notifData } = await supabase
    .from('notifications')
    .select('id, title, body, type, booking_id, complaint_id, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const initialNotifications = notifData ?? []

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100">
          <span className="text-base font-bold text-blue-600">CleanConnect</span>
        </div>

        {/* User identity */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-400">{ROLE_LABELS[role]}</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <span className="text-base shrink-0">{link.icon}</span>
              {link.label}
            </a>
          ))}
        </nav>

        {/* Sign out — prominent at bottom */}
        <div className="px-3 py-3 border-t border-gray-100">
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
            >
              <span className="text-base">🚪</span>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-end gap-3">
          <NotificationBell
            userId={user.id}
            role={role}
            initialNotifications={initialNotifications}
          />
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
            {ROLE_LABELS[role]}
          </span>
          <span className="text-sm font-medium text-gray-700">{displayName}</span>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
