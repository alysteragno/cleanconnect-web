import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
}
const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
}

export default async function CustomerComplaintsPage() {
  const supabase = await createClient()
  const { data: complaints } = await supabase
    .from('complaints')
    .select('id, subject, status, created_at, bookings (service_type)')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Complaints & Support</h1>
          <p className="text-sm text-gray-500 mt-0.5">File a complaint or follow up on an existing one.</p>
        </div>
        <Link
          href="/customer/complaints/new"
          className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          + New complaint
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {!complaints || complaints.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400">No complaints filed yet.</p>
          </div>
        ) : (
          complaints.map((c) => (
            <Link
              key={c.id}
              href={`/customer/complaints/${c.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{c.subject}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(c.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[c.status] ?? ''}`}>
                {STATUS_LABELS[c.status] ?? c.status}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
