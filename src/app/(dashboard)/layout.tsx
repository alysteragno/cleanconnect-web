import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { logout } from '@/app/actions/auth'
import NotificationBell from '@/components/dashboard/notification-bell'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import {
  IconDashboard, IconCalendar, IconUsers, IconChat, IconStar,
  IconChart, IconSettings, IconSignOut, IconChevronRight, IconMegaphone,
} from '@/components/icons'

const ADMIN_NAV = [
  { href: '/admin',                  label: 'Dashboard',     icon: <IconDashboard /> },
  { href: '/admin/bookings',         label: 'Bookings',      icon: <IconCalendar /> },
  { href: '/admin/cleaners',         label: 'Cleaners',      icon: <IconUsers /> },
  { href: '/admin/complaints',       label: 'Complaints',    icon: <IconChat /> },
  { href: '/admin/feedback',         label: 'Feedback',      icon: <IconStar /> },
  { href: '/admin/announcements',    label: 'Announcements', icon: <IconMegaphone /> },
  { href: '/admin/reports',          label: 'Reports',       icon: <IconChart /> },
  { href: '/admin/settings',         label: 'Settings',      icon: <IconSettings /> },
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

  const cookieStore = await cookies()
  const roleCookie  = cookieStore.get('cleanconnect-role')?.value
  const role        = profile?.role ?? roleCookie ?? 'customer'
  const displayName = profile?.full_name ?? user.email ?? 'User'

  if (role === 'customer' || role === 'cleaner') {
    return <>{children}</>
  }

  const [{ data: notifData }, { data: announcementData }] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, title, body, type, booking_id, complaint_id, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('announcements')
      .select('id, title, body, created_at, poster:profiles!created_by(full_name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-16 px-4 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0 overflow-hidden">
          <Image
            src="/Logo.webp"
            alt="Maid For You Cleaning Services"
            width={36}
            height={36}
            className="w-full h-full object-cover"
            priority
          />
        </div>
        <span className="text-white font-semibold text-sm leading-tight">Maid For You</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        <SidebarNav links={ADMIN_NAV} />
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 shrink-0 border-t border-pink-600 space-y-0.5">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{displayName}</p>
            <p className="text-xs text-pink-200 capitalize">{role.replace('_', ' ')}</p>
          </div>
        </div>
        <Link
          href="/admin/settings"
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-pink-200 hover:bg-pink-600 hover:text-white transition-colors text-sm"
        >
          <span className="flex items-center gap-2.5">
            <IconSettings />
            Settings
          </span>
          <IconChevronRight />
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-pink-200 hover:text-white hover:bg-pink-600 transition-colors"
          >
            <span className="shrink-0"><IconSignOut /></span>
            Sign out
          </button>
        </form>
      </div>
    </>
  )

  const topBarContent = (
    <>
      <NotificationBell
        userId={user.id}
        role={role}
        initialNotifications={notifData ?? []}
        initialAnnouncements={(announcementData ?? []) as any[]}
      />
      <span className="w-px h-4 bg-gray-200" />
      <span className="text-sm text-gray-700 font-medium">{displayName}</span>
    </>
  )

  return (
    <DashboardShell sidebarContent={sidebarContent} topBarContent={topBarContent}>
      {children}
    </DashboardShell>
  )
}
