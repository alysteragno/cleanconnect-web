import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

type Assignment = {
  id: string
  status: string
  bookings: {
    id: string
    service_date: string
    service_time: string
    service_type: string
    property_sqm: number
    base_price: number
    status: string
    address_street: string | null
    address_city: string | null
    branches: { name: string } | null
  } | null
}

const SERVICE_LABELS: Record<string, string> = {
  general: 'General Cleaning',
  premium_mattress: 'Mattress & Upholstery',
  complete: 'Complete Package',
  disinfection: 'Disinfection',
  post_construction: 'Post-Construction',
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}
function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

const NAV_CARDS = [
  { href: '/cleaner/jobs', label: 'My Jobs', description: 'Offers & active assignments', icon: '📋' },
  { href: '/cleaner/schedule', label: 'Schedule', description: 'Upcoming work calendar', icon: '📅' },
  { href: '/cleaner/profile', label: 'Profile', description: 'Update your account', icon: '👤' },
]

export default async function CleanerPage() {
  const supabase = await createClient()

  const [{ data: offers }, { data: active }] = await Promise.all([
    supabase
      .from('cleaner_assignments')
      .select('id, status, bookings (id, service_date, service_time, service_type, property_sqm, base_price, status, address_street, address_city, branches (name))')
      .eq('status', 'offered')
      .order('assigned_at', { ascending: true })
      .limit(5),
    supabase
      .from('cleaner_assignments')
      .select('id, status, bookings (id, service_date, service_time, service_type, property_sqm, base_price, status, address_street, address_city, branches (name))')
      .eq('status', 'accepted')
      .order('assigned_at', { ascending: true })
      .limit(5),
  ])

  const offerList = (offers ?? []) as unknown as Assignment[]
  const activeList = (active ?? []) as unknown as Assignment[]

  return (
    <div className="max-w-3xl space-y-8">
      {/* Nav cards */}
      <div className="grid grid-cols-3 gap-4">
        {NAV_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-all"
          >
            <span className="text-2xl block mb-2">{card.icon}</span>
            <p className="text-sm font-semibold text-gray-900">{card.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.description}</p>
          </Link>
        ))}
      </div>

      {/* Job offers */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Job Offers</h2>
            <p className="text-xs text-gray-400 mt-0.5">Accept or decline before they expire</p>
          </div>
          {offerList.length > 0 && (
            <span className="text-xs bg-yellow-100 text-yellow-700 font-semibold px-2 py-0.5 rounded-full">
              {offerList.length} new
            </span>
          )}
        </div>

        {offerList.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No job offers right now.</p>
        ) : (
          <div className="space-y-3">
            {offerList.map((a) => {
              const b = a.bookings
              if (!b) return null
              return (
                <Link
                  key={a.id}
                  href={`/cleaner/jobs/${a.id}`}
                  className="flex items-center justify-between p-3 border border-yellow-200 bg-yellow-50 rounded-lg hover:border-yellow-400 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {SERVICE_LABELS[b.service_type] ?? 'Cleaning'} · {b.property_sqm} sqm
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {b.branches?.name} · {formatDate(b.service_date)} at {formatTime(b.service_time)}
                    </p>
                    {b.address_city && (
                      <p className="text-xs text-gray-400">{b.address_city}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-gray-900">
                      ₱{Number(b.base_price).toLocaleString()}
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5 group-hover:underline">View →</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Active / upcoming jobs */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Active &amp; Upcoming</h2>
          <Link href="/cleaner/schedule" className="text-xs text-blue-600 hover:underline font-medium">
            Full schedule
          </Link>
        </div>

        {activeList.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No active jobs.</p>
        ) : (
          <div className="space-y-3">
            {activeList.map((a) => {
              const b = a.bookings
              if (!b) return null
              const isInProgress = b.status === 'in_progress'
              return (
                <Link
                  key={a.id}
                  href={`/cleaner/jobs/${a.id}`}
                  className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-gray-300 transition-colors group"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-gray-900">
                        {SERVICE_LABELS[b.service_type] ?? 'Cleaning'} · {b.property_sqm} sqm
                      </p>
                      {isInProgress && (
                        <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-1.5 py-0.5 rounded-full">
                          In Progress
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {b.branches?.name} · {formatDate(b.service_date)} at {formatTime(b.service_time)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-gray-900">
                      ₱{Number(b.base_price).toLocaleString()}
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5 group-hover:underline">View →</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
