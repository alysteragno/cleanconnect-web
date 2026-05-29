import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

type Booking = {
  id: string
  service_date: string
  service_time: string
  service_type: string
  property_sqm: number
  base_price: number
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  branches: { name: string } | null
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const SERVICE_LABELS: Record<string, string> = {
  general: 'General Cleaning',
  premium_mattress: 'Mattress & Upholstery',
  complete: 'Complete Package',
  disinfection: 'Disinfection',
  post_construction: 'Post-Construction',
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${m} ${suffix}`
}

const NAV_CARDS = [
  {
    href: '/customer/book',
    label: 'Book a Service',
    description: 'Schedule a new cleaning',
    icon: '📋',
    accent: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50',
  },
  {
    href: '/customer/bookings',
    label: 'My Bookings',
    description: 'View status & history',
    icon: '📅',
    accent: 'border-purple-200 hover:border-purple-400 hover:bg-purple-50',
  },
  {
    href: '/customer/profile',
    label: 'Profile & Settings',
    description: 'Update your account',
    icon: '👤',
    accent: 'border-green-200 hover:border-green-400 hover:bg-green-50',
  },
  {
    href: '/customer/help',
    label: 'Help & Support',
    description: 'FAQs and contact',
    icon: '💬',
    accent: 'border-orange-200 hover:border-orange-400 hover:bg-orange-50',
  },
]

export default async function CustomerPage() {
  const supabase = await createClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, service_date, service_time, service_type, property_sqm, base_price, status, branches (name)')
    .order('created_at', { ascending: false })
    .limit(3)

  const recentBookings = (bookings ?? []) as unknown as Booking[]

  return (
    <div className="max-w-3xl space-y-8">
      {/* Nav cards */}
      <div className="grid grid-cols-2 gap-4">
        {NAV_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`bg-white rounded-xl border p-5 flex items-start gap-4 transition-all ${card.accent}`}
          >
            <span className="text-2xl shrink-0">{card.icon}</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">{card.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent bookings */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Recent Bookings</h2>
          <Link href="/customer/bookings" className="text-xs text-blue-600 hover:underline font-medium">
            View all
          </Link>
        </div>

        {recentBookings.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-gray-400 mb-4">No bookings yet.</p>
            <Link
              href="/customer/book"
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Book your first cleaning
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentBookings.map((b) => (
              <Link
                key={b.id}
                href={`/customer/bookings/${b.id}`}
                className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-gray-300 transition-colors group"
              >
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-gray-900">
                      {SERVICE_LABELS[b.service_type] ?? 'Cleaning Service'}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${STATUS_STYLES[b.status] ?? ''}`}
                    >
                      {STATUS_LABELS[b.status] ?? b.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {b.branches?.name} · {formatDate(b.service_date)} at {formatTime(b.service_time)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">
                    ₱{Number(b.base_price).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 group-hover:text-blue-600 transition-colors">
                    View →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
