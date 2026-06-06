import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  in_progress: 'bg-pink-50 text-pink-700 border-pink-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
}
const STATUS_LABELS: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', resolved: 'Resolved',
}

export default async function AdminComplaintsPage() {
  const supabase = await createClient()
  const { data: complaints } = await supabase
    .from('complaints')
    .select('id, subject, status, created_at, profiles (full_name)')
    .order('created_at', { ascending: false })

  const open = (complaints ?? []).filter((c) => c.status !== 'resolved').length

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Complaints</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {open} open · {(complaints ?? []).length} total
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {!complaints || complaints.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400">No complaints yet.</p>
          </div>
        ) : (
          complaints.map((c) => (
            <Link
              key={c.id}
              href={`/admin/complaints/${c.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{c.subject}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {((Array.isArray(c.profiles) ? c.profiles[0] : c.profiles) as { full_name: string } | null)?.full_name ?? 'Customer'} ·{' '}
                  {new Date(c.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${STATUS_STYLES[c.status] ?? ''}`}>
                {STATUS_LABELS[c.status] ?? c.status}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
