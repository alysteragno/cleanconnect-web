import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

type CompletedBooking = {
  id: string
  service_date: string
  service_type: string
  property_sqm: number
  base_price: number
  payment_status: string
  payment_method: string
  profiles: { full_name: string } | null
  branches: { name: string } | null
}

type CleanerStat = {
  id: string
  full_name: string
  branches: { name: string } | null
  jobs: number
  avgRating: number | null
}

const SERVICE_LABELS: Record<string, string> = {
  general: 'General Cleaning', premium_mattress: 'Mattress & Upholstery',
  complete: 'Complete Package', disinfection: 'Disinfection', post_construction: 'Post-Construction',
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function ReportsPage() {
  const supabase = await createClient()

  const [
    { data: completedBookings },
    { data: allBookings },
    { data: cleaners },
    { data: feedbackRows },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, service_date, service_type, property_sqm, base_price, payment_status, payment_method, profiles!customer_id (full_name), branches (name)')
      .eq('status', 'completed')
      .order('service_date', { ascending: false })
      .limit(50),
    supabase.from('bookings').select('status, base_price, payment_status'),
    supabase
      .from('profiles')
      .select('id, full_name, branches (name)')
      .eq('role', 'cleaner')
      .eq('is_active', true)
      .order('full_name'),
    supabase.from('feedback').select('cleaner_id, rating'),
  ])

  const completed = (completedBookings ?? []) as unknown as CompletedBooking[]
  const all = (allBookings ?? []) as { status: string; base_price: number; payment_status: string }[]
  const cleanerList = (cleaners ?? []) as unknown as { id: string; full_name: string; branches: { name: string } | null }[]
  const feedback = (feedbackRows ?? []) as { cleaner_id: string; rating: number }[]

  // Financial summary
  const totalRevenue = all.filter((b) => b.payment_status === 'paid').reduce((s, b) => s + Number(b.base_price), 0)
  const unpaidRevenue = all.filter((b) => b.payment_status === 'unpaid').reduce((s, b) => s + Number(b.base_price), 0)
  const statusCounts = all.reduce((acc, b) => { acc[b.status] = (acc[b.status] ?? 0) + 1; return acc }, {} as Record<string, number>)

  // Cleaner performance
  const cleanerStats: CleanerStat[] = await Promise.all(
    cleanerList.map(async (c) => {
      const { count } = await supabase
        .from('cleaner_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('cleaner_id', c.id)
        .eq('status', 'completed')
      const myFeedback = feedback.filter((f) => f.cleaner_id === c.id)
      const avgRating = myFeedback.length > 0
        ? myFeedback.reduce((s, f) => s + f.rating, 0) / myFeedback.length
        : null
      return { ...c, jobs: count ?? 0, avgRating }
    })
  )

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex items-baseline justify-between">
        <div>
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Dashboard</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-2">Reports</h1>
        </div>
        <button
          onClick={() => typeof window !== 'undefined' && window.print()}
          className="text-sm px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors print:hidden"
        >
          🖨 Print / Export PDF
        </button>
      </div>

      {/* Financial Summary */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Financial Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Stat label="Total Bookings" value={String(all.length)} />
          <Stat label="Completed" value={String(statusCounts['completed'] ?? 0)} color="text-green-600" />
          <Stat label="Revenue Collected" value={`₱${totalRevenue.toLocaleString()}`} color="text-pink-600" />
          <Stat label="Receivables" value={`₱${unpaidRevenue.toLocaleString()}`} color="text-yellow-600" />
        </div>
        <div className="bg-white rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <Th>Status</Th><Th>Count</Th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(statusCounts).map(([s, n]) => (
                <tr key={s} className="border-b border-gray-50">
                  <Td className="capitalize">{s.replace('_', ' ')}</Td>
                  <Td>{n}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cleaner Performance */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Cleaner Performance</h2>
        <div className="bg-white rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <Th>Cleaner</Th><Th>Branch</Th><Th>Jobs Done</Th><Th>Avg Rating</Th>
              </tr>
            </thead>
            <tbody>
              {cleanerStats.sort((a, b) => b.jobs - a.jobs).map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <Td>{c.full_name}</Td>
                  <Td>{c.branches?.name ?? '—'}</Td>
                  <Td>{c.jobs}</Td>
                  <Td>
                    {c.avgRating != null ? (
                      <span className="flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        {c.avgRating.toFixed(1)}
                      </span>
                    ) : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Service History */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Service History (Last 50 Completed)</h2>
        <div className="bg-white rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <Th>Date</Th><Th>Branch</Th><Th>Service</Th><Th>Customer</Th><Th>Amount</Th><Th>Payment</Th>
              </tr>
            </thead>
            <tbody>
              {completed.map((b) => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <Td>{formatDate(b.service_date)}</Td>
                  <Td>{b.branches?.name ?? '—'}</Td>
                  <Td>{SERVICE_LABELS[b.service_type] ?? b.service_type}</Td>
                  <Td>{b.profiles?.full_name ?? '—'}</Td>
                  <Td>₱{Number(b.base_price).toLocaleString()}</Td>
                  <Td className="capitalize">{b.payment_status}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, color = 'text-gray-900' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-gray-700 ${className}`}>{children}</td>
}
