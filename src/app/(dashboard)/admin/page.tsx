import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { StatCard } from '@/components/ui/stat-card'

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

      </div>
  )
}