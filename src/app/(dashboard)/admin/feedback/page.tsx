import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

type Feedback = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  bookings: {
    service_date: string
    service_type: string
  } | null
  profiles: { full_name: string } | null
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? 'text-yellow-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  )
}

const SERVICE_LABELS: Record<string, string> = {
  general: 'General', premium_mattress: 'Mattress', complete: 'Complete',
  disinfection: 'Disinfection', post_construction: 'Post-Construction',
}

export default async function AdminFeedbackPage() {
  const supabase = await createClient()

  const [{ data: feedbackRows }, { data: avgData }] = await Promise.all([
    supabase
      .from('feedback')
      .select('id, rating, comment, created_at, bookings (service_date, service_type), profiles!customer_id (full_name)')
      .order('created_at', { ascending: false }),
    supabase.from('feedback').select('rating'),
  ])

  const list = (feedbackRows ?? []) as unknown as Feedback[]
  const ratings = (avgData ?? []) as { rating: number }[]
  const avg = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
    : '—'

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Dashboard</Link>
        <div className="flex items-baseline justify-between mt-2">
          <h1 className="text-xl font-bold text-gray-900">Customer Feedback</h1>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-yellow-500">★</span>
            <span className="text-lg font-bold text-gray-900">{avg}</span>
            <span className="text-sm text-gray-400">/ 5 ({list.length} reviews)</span>
          </div>
        </div>
      </div>

      {/* Rating distribution */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Rating Distribution</p>
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = ratings.filter((r) => r.rating === star).length
            const pct = ratings.length > 0 ? (count / ratings.length) * 100 : 0
            return (
              <div key={star} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-8 shrink-0">{star} ★</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-yellow-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Reviews list */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">All Reviews</p>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No feedback yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.map((f) => (
              <div key={f.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div>
                    <Stars rating={f.rating} />
                    <p className="text-xs text-gray-400 mt-1">
                      {f.profiles?.full_name ?? 'Customer'} ·{' '}
                      {SERVICE_LABELS[f.bookings?.service_type ?? ''] ?? 'Service'}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 shrink-0">
                    {new Date(f.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                {f.comment && (
                  <p className="text-sm text-gray-700 italic mt-2">&ldquo;{f.comment}&rdquo;</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
