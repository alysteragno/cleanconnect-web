import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

type Branch = { id: string; name: string; region: string }

const NAV_CARDS = [
  { href: '/admin/bookings', label: 'All Bookings', description: 'View & manage every booking', icon: '📋' },
  { href: '/admin/cleaners', label: 'Cleaners', description: 'Create and manage cleaners', icon: '👷' },
  { href: '/admin/branches', label: 'Branches', description: 'Manage branch locations', icon: '🏢' },
  { href: '/admin/feedback', label: 'Feedback', description: 'Customer ratings & reviews', icon: '⭐' },
  { href: '/admin/reports', label: 'Reports', description: 'Service, financial & deployment', icon: '📊' },
]

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

  const branchList = (branches ?? []) as Branch[]

  // Per-branch booking stats
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

  const GLOBAL_STATS = [
    { label: 'Total Bookings', value: totalBookings ?? 0, color: 'text-gray-900', bg: 'bg-gray-50 border-gray-200' },
    { label: 'Pending Dispatch', value: pendingCount ?? 0, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
    { label: 'In Progress', value: inProgressCount ?? 0, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
    { label: 'Completed Today', value: completedToday ?? 0, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
    { label: 'Active Cleaners', value: totalCleaners ?? 0, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  ]

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Global overview — all branches</p>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {GLOBAL_STATS.map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Nav cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {NAV_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-all"
          >
            <span className="text-2xl block mb-2">{card.icon}</span>
            <p className="text-sm font-semibold text-gray-900">{card.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.description}</p>
          </Link>
        ))}
      </div>

      {/* Per-branch breakdown */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Branch Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branchStats.map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                  <p className="text-xs text-gray-400">{b.region}</p>
                </div>
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                  {b.cleaners} cleaner{b.cleaners !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-yellow-600">{b.pending}</p>
                  <p className="text-xs text-gray-400">Pending</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-purple-600">{b.active}</p>
                  <p className="text-xs text-gray-400">Active</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">{b.doneToday}</p>
                  <p className="text-xs text-gray-400">Done today</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
