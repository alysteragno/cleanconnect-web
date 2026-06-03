import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { StatCard } from '@/components/ui/stat-card'

type RecentAnnouncement = {
  id: string
  title: string
  body: string | null
  is_active: boolean
  created_at: string
  poster: { full_name: string } | null
}

export default async function AdminPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { count: totalBookings },
    { count: pendingCount },
    { count: inProgressCount },
    { count: completedToday },
    { count: totalCleaners },
    { data: branches },
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'completed').eq('service_date', today),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'cleaner').eq('is_active', true),
    supabase.from('branches').select('id, name, region').order('name'),
  ])

  const branchList = (branches ?? []) as { id: string; name: string; region: string }[]

  const { data: announcementsData } = await supabase
    .from('announcements')
    .select('id, title, body, is_active, created_at, poster:created_by(full_name)')
    .order('created_at', { ascending: false })
    .limit(5)

  const recentAnnouncements = (announcementsData ?? []) as unknown as RecentAnnouncement[]

  const branchStats = await Promise.all(
    branchList.map(async (b) => {
      const [
        { count: bPending },
        { count: bActive },
        { count: bDoneToday },
        { count: bCleaners },
      ] = await Promise.all([
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('branch_id', b.id).eq('status', 'pending'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('branch_id', b.id).in('status', ['confirmed', 'in_progress']),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('branch_id', b.id).eq('status', 'completed').eq('service_date', today),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('branch_id', b.id).eq('role', 'cleaner').eq('is_active', true),
      ])
      return { ...b, pending: bPending ?? 0, active: bActive ?? 0, doneToday: bDoneToday ?? 0, cleaners: bCleaners ?? 0 }
    })
  )

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Operations overview &mdash; {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Total Bookings"    value={totalBookings ?? 0}    tone="neutral" />
        <StatCard label="Pending Dispatch"  value={pendingCount ?? 0}     tone="amber" />
        <StatCard label="In Progress"       value={inProgressCount ?? 0}  tone="violet" />
        <StatCard label="Completed Today"   value={completedToday ?? 0}   tone="emerald" />
        <StatCard label="Active Cleaners"   value={totalCleaners ?? 0}    tone="blue" />
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { href: '/admin/bookings',       label: 'Bookings',       sub: 'View all' },
            { href: '/admin/cleaners',       label: 'Cleaners',       sub: 'Manage staff' },
            { href: '/admin/complaints',     label: 'Complaints',     sub: 'Review tickets' },
            { href: '/admin/announcements',  label: 'Announcements',  sub: 'Post updates' },
            { href: '/admin/reports',        label: 'Reports',        sub: 'Export data' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white rounded-xl border border-gray-200 px-4 py-3.5 hover:border-pink-300 hover:bg-pink-50 transition-all group"
            >
              <p className="text-sm font-semibold text-gray-900 group-hover:text-pink-700">{item.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Announcements */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent Announcements</h2>
          <Link href="/admin/announcements" className="text-xs text-pink-600 hover:underline">Manage →</Link>
        </div>
        <div className="bg-white rounded-xl border border-gray-200">
          {recentAnnouncements.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No announcements yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentAnnouncements.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-gray-900">{a.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      a.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-50 text-gray-400 border-gray-200'
                    }`}>
                      {a.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                  {a.body && <p className="text-xs text-gray-500 line-clamp-1">{a.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(a.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    <span className="ml-1.5">· Posted by <span className="font-medium text-gray-500">{a.poster?.full_name ?? 'Admin'}</span></span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      </div>
  )
}