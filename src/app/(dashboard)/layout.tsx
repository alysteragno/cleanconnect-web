import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { logout } from '@/app/actions/auth'
import NotificationBell from '@/components/dashboard/notification-bell'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import {
  IconDashboard, IconCalendar, IconUsers, IconBuilding,
  IconStar, IconChat, IconChart, IconSettings, IconSignOut,
} from '@/components/icons'

const ADMIN_NAV = [
  { href: '/admin',            label: 'Dashboard',  icon: <IconDashboard /> },
  { href: '/admin/bookings',   label: 'Bookings',   icon: <IconCalendar /> },
  { href: '/admin/cleaners',   label: 'Cleaners',   icon: <IconUsers /> },
  { href: '/admin/branches',   label: 'Branch',     icon: <IconBuilding /> },
  { href: '/admin/feedback',   label: 'Feedback',   icon: <IconStar /> },
  { href: '/admin/complaints', label: 'Complaints', icon: <IconChat /> },
  { href: '/admin/reports',    label: 'Reports',    icon: <IconChart /> },
  { href: '/admin/settings',   label: 'Settings',   icon: <IconSettings /> },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'customer'
  const displayName = profile?.full_name ?? user.email ?? 'User'

  // customer / cleaner roles see mobile placeholder fullscreen — no sidebar needed
  if (role === 'customer' || role === 'cleaner') {
    return <>{children}</>
  }

  const { data: notifData } = await supabase
    .from('notifications')
    .select('id, title, body, type, booking_id, complaint_id, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Fixed sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col fixed inset-y-0 left-0 z-20">
        {/* Logo */}
        <div className="h-14 px-4 flex items-center border-b border-gray-100 shrink-0">
          <Link href="/admin">
            <Image
              src="/Logo.jpg"
              alt="Maid For You Cleaning Services"
              width={110}
              height={32}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>
        </div>

        {/* Nav links */}
        <SidebarNav links={ADMIN_NAV} />

        {/* User info + sign out */}
        <div className="border-t border-gray-100 px-3 py-3 space-y-0.5 shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-400">Admin</p>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <span className="shrink-0"><IconSignOut /></span>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Content — offset by sidebar width */}
      <div className="flex-1 flex flex-col min-w-0 ml-56">
        <header className="h-14 bg-white border-b border-gray-100 px-6 flex items-center justify-end gap-3 sticky top-0 z-10">
          <NotificationBell
            userId={user.id}
            role={role}
            initialNotifications={notifData ?? []}
          />
          <span className="w-px h-4 bg-gray-200" />
          <span className="text-sm text-gray-600 font-medium">{displayName}</span>
        </header>

        <main className="flex-1 p-6 max-w-screen-xl">{children}</main>
      </div>
    </div>
  )
}
