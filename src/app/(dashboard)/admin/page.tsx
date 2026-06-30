import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { StatCard } from '@/components/ui/stat-card'
import {
  IconCalendar, IconClock, IconCheck, IconUsers, IconChart,
  IconArrowUpRight, IconZap,
} from '@/components/icons'

const STATUS_STYLES: Record<string, string> = {
  pending:     'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed:   'bg-pink-50 text-pink-700 border-pink-200',
  in_progress: 'bg-purple-50 text-purple-700 border-purple-200',
  completed:   'bg-green-50 text-green-700 border-green-200',
  cancelled:   'bg-red-50 text-red-700 border-red-200',
}

const PAYMENT_STYLES: Record<string, string> = {
  paid:    'bg-emerald-50 text-emerald-700',
  unpaid:  'bg-gray-100 text-gray-500',
  partial: 'bg-blue-50 text-blue-700',
}

const PAYMENT_LABELS: Record<string, string> = {
  paid:    'Paid',
  unpaid:  'Processing Payment',
  partial: 'Partial',
}


function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}
function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const AVATAR_COLORS = [
  'bg-pink-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500',
  'bg-blue-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500',
]
function avatarColor(name: string) {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{children}</h2>
}

type ActionTone = 'amber' | 'pink' | 'violet'

const ACTION_TONE: Record<ActionTone, { border: string; bg: string; icon: string; text: string; arrow: string }> = {
  amber:  { border: 'hover:border-amber-300',  bg: 'hover:bg-amber-50/60',  icon: 'bg-amber-100 text-amber-600',   text: 'group-hover:text-amber-700',  arrow: 'group-hover:text-amber-500'  },
  pink:   { border: 'hover:border-pink-300',   bg: 'hover:bg-pink-50/60',   icon: 'bg-pink-100 text-pink-600',     text: 'group-hover:text-pink-700',   arrow: 'group-hover:text-pink-500'   },
  violet: { border: 'hover:border-violet-300', bg: 'hover:bg-violet-50/60', icon: 'bg-violet-100 text-violet-600', text: 'group-hover:text-violet-700', arrow: 'group-hover:text-violet-500' },
}

function QuickActionCard({
  href, icon, label, sub, tone,
}: {
  href: string
  icon: React.ReactNode
  label: string
  sub: string
  tone: ActionTone
}) {
  const t = ACTION_TONE[tone]
  return (
    <Link
      href={href}
      className={`group bg-white border border-gray-200 rounded-xl px-4 py-3.5 flex items-center gap-3 ${t.border} ${t.bg} transition-all duration-200 shadow-sm hover:shadow-md`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200 ${t.icon}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold text-gray-800 transition-colors ${t.text}`}>{label}</p>
        <p className="text-xs text-gray-500">{sub}</p>
      </div>
      <IconArrowUpRight className={`ml-auto shrink-0 text-gray-300 transition-colors ${t.arrow}`} />
    </Link>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const supabase = createAdminClient()
  const today   = new Date().toISOString().split('T')[0]
  const hour    = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const [
    { count: totalBookings },
    { count: pendingCount },
    { count: inProgressCount },
    { count: completedToday },
    { count: totalCleaners },
    { data: recentBookings, error: bookingsError },
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'completed').eq('service_date', today),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'cleaner').eq('is_active', true),
    supabase
      .from('bookings')
      .select('id, service_date, service_time, service_name, property_sqm, base_price, status, payment_status, profiles!customer_id (full_name)')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  type RecentBooking = {
    id: string
    service_date: string
    service_time: string
    service_name: string | null
    property_sqm: number
    base_price: number
    status: string
    payment_status: string
    profiles: { full_name: string } | null
  }
  const bookingList = (recentBookings ?? []) as unknown as RecentBooking[]

  return (
    <div className="space-y-7">

      {/* Gradient welcome banner */}
      <div className="rounded-2xl bg-gradient-to-br from-pink-600 via-pink-600 to-pink-500 px-6 py-5 shadow-sm overflow-hidden relative">
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-8 right-16 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-pink-200 text-sm font-medium">{greeting}</p>
            <h1 className="text-xl font-bold text-white mt-0.5 tracking-tight">Operations Dashboard</h1>
            <p className="text-pink-200/80 text-xs mt-1">
              {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0">
            <div className="bg-white/20 backdrop-blur rounded-lg px-3 py-1.5 text-xs font-semibold text-white">
              {totalBookings ?? 0} total bookings
            </div>
            <div className="bg-white/10 rounded-lg px-3 py-1.5 text-xs text-pink-100">
              {pendingCount ?? 0} pending dispatch
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Total Bookings"   value={totalBookings ?? 0}   tone="neutral" icon={<IconCalendar />} />
        <StatCard label="Pending Dispatch" value={pendingCount ?? 0}    tone="amber"   icon={<IconClock />} />
        <StatCard label="In Progress"      value={inProgressCount ?? 0} tone="violet"  icon={<IconZap />} />
        <StatCard label="Completed Today"  value={completedToday ?? 0}  tone="emerald" icon={<IconCheck />} />
        <StatCard label="Active Cleaners"  value={totalCleaners ?? 0}   tone="blue"    icon={<IconUsers />} />
      </div>

      {/* Quick Actions */}
      <div>
        <SectionLabel>Quick Actions</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2.5">
          <QuickActionCard href="/admin/bookings?status=pending" icon={<IconClock />}  label="Dispatch Pending"  sub={`${pendingCount ?? 0} bookings awaiting`} tone="amber"  />
          <QuickActionCard href="/admin/cleaners"                icon={<IconUsers />}  label="Manage Cleaners"   sub={`${totalCleaners ?? 0} active cleaners`}   tone="pink"   />
          <QuickActionCard href="/admin/reports"                 icon={<IconChart />}  label="View Reports"      sub="Analytics &amp; exports"                   tone="violet" />
        </div>
      </div>

      {/* Recent Bookings */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <SectionLabel>Recent Bookings</SectionLabel>
          <Link
            href="/admin/bookings"
            className="text-xs text-pink-600 hover:text-pink-700 font-semibold flex items-center gap-1 transition-colors"
          >
            View all <IconArrowUpRight />
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {bookingsError ? (
            <p className="text-sm text-red-500 text-center py-12 px-4 font-mono break-all">{bookingsError.message}</p>
          ) : bookingList.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <IconCalendar className="text-gray-400" />
              </div>
              <p className="text-sm text-gray-400 font-medium">No bookings yet</p>
              <p className="text-xs text-gray-300 mt-1">Bookings will appear here once created.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {bookingList.map((b) => {
                const customerName = b.profiles?.full_name ?? 'Customer'
                return (
                  <Link
                    key={b.id}
                    href={`/admin/bookings/${b.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors group"
                  >
                    <div className={`w-8 h-8 rounded-full ${avatarColor(customerName)} text-white flex items-center justify-center text-xs font-bold shrink-0 select-none`}>
                      {getInitials(customerName)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 truncate">{customerName}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold capitalize tracking-wide ${STATUS_STYLES[b.status] ?? ''}`}>
                          {b.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {b.service_name ?? 'Cleaning'} · {b.property_sqm} sqm · {formatDate(b.service_date)} at {formatTime(b.service_time)}
                      </p>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      <p className="text-sm font-bold text-gray-900">₱{Number(b.base_price).toLocaleString()}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PAYMENT_STYLES[b.payment_status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {PAYMENT_LABELS[b.payment_status] ?? b.payment_status}
                      </span>
                    </div>

                    <IconArrowUpRight className="text-gray-300 group-hover:text-pink-500 transition-colors shrink-0 ml-1" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
