import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import ReviewModal from './review-form'
import FiltersBar from './filters-bar'

type CleanerInfo = {
  id: string
  full_name: string
  phone: string | null
}

type ReviewerInfo = { id: string; full_name: string } | null

type DayOffRequest = {
  id: string
  requested_date: string
  status: 'pending' | 'approved' | 'rejected'
  reason: string | null
  notes: string | null
  admin_notes: string | null
  reviewed_at: string | null
  created_at: string
  cleaner: CleanerInfo | null
  reviewer: ReviewerInfo
}

const STATUS_META: Record<string, { pill: string; dot: string; label: string }> = {
  pending:  { pill: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400', label: 'Pending'  },
  approved: { pill: 'bg-green-50 text-green-700 border-green-200',   dot: 'bg-green-500',  label: 'Approved' },
  rejected: { pill: 'bg-red-50 text-red-700 border-red-200',         dot: 'bg-red-400',    label: 'Rejected' },
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtTs(ts: string) {
  return new Date(ts).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default async function AdminDayOffRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; month?: string }>
}) {
  const { status = 'pending', month = '' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') redirect('/login')

  const adminClient = createAdminClient()

  let query = adminClient
    .from('cleaner_day_off_requests')
    .select(`
      id,
      requested_date,
      status,
      reason,
      notes,
      admin_notes,
      reviewed_at,
      created_at,
      cleaner:profiles!cleaner_id (
        id,
        full_name,
        phone
      ),
      reviewer:profiles!reviewed_by (
        id,
        full_name
      )
    `)

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  if (month) {
    const [y, m] = month.split('-').map(Number)
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(y, m, 0).getDate()
    const end = `${y}-${String(m).padStart(2, '0')}-${lastDay}`
    query = query.gte('requested_date', start).lte('requested_date', end)
  }

  query = query.order('created_at', { ascending: false })

  const { data: rows } = await query
  let requests = (rows ?? []) as unknown as DayOffRequest[]

  // Pending rows float to top, then preserve created_at desc order
  requests.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return 0
  })

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Day-Off Requests</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and approve or reject cleaner day-off requests.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm font-semibold rounded-full w-fit">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Filter bar */}
      <FiltersBar status={status} month={month} />

      {/* Table */}
      {requests.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl bg-white">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">No requests found for the selected filters.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Cleaner</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Requested Date</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Submitted</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Decision By</th>
                  <th className="px-5 py-3.5 w-[160px]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((r) => {
                  const sm = STATUS_META[r.status] ?? STATUS_META.pending
                  const initials = r.cleaner?.full_name?.charAt(0).toUpperCase() ?? '?'
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">

                      {/* Cleaner */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 min-w-[160px]">
                          <div className="w-9 h-9 rounded-full bg-pink-100 text-pink-700 text-xs font-bold flex items-center justify-center shrink-0 select-none">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate max-w-[140px]">
                              {r.cleaner?.full_name ?? '—'}
                            </p>
                            {r.cleaner?.phone && (
                              <p className="text-xs text-gray-400">{r.cleaner.phone}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Requested date */}
                      <td className="px-5 py-4">
                        <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                          {fmtDate(r.requested_date)}
                        </span>
                      </td>

                      {/* Reason + cleaner notes + admin note */}
                      <td className="px-5 py-4 max-w-[220px]">
                        <span className="text-sm text-gray-600">
                          {r.reason ?? <span className="text-gray-300">—</span>}
                        </span>
                        {r.notes && (
                          <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2" title={r.notes}>
                            {r.notes}
                          </p>
                        )}
                        {r.status !== 'pending' && r.admin_notes && (
                          <p className="text-xs text-gray-400 mt-0.5 italic leading-snug">
                            Admin: {r.admin_notes}
                          </p>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border rounded-full whitespace-nowrap ${sm.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                          {sm.label}
                        </span>
                      </td>

                      {/* Submitted */}
                      <td className="px-5 py-4">
                        <span className="text-sm text-gray-500 whitespace-nowrap">{fmtTs(r.created_at)}</span>
                      </td>

                      {/* Decision by */}
                      <td className="px-5 py-4">
                        {r.reviewer && r.status !== 'pending' ? (
                          <div>
                            <p className="text-xs font-semibold mb-0.5 whitespace-nowrap">
                              {r.status === 'approved' ? (
                                <span className="text-green-600">Approved by</span>
                              ) : (
                                <span className="text-red-500">Declined by</span>
                              )}
                            </p>
                            <p className="text-sm font-medium text-gray-700">{r.reviewer.full_name}</p>
                            {r.reviewed_at && (
                              <p className="text-xs text-gray-400 whitespace-nowrap">{fmtTs(r.reviewed_at)}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-300">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        {r.status === 'pending' && (
                          <ReviewModal
                            requestId={r.id}
                            cleanerName={r.cleaner?.full_name ?? 'this cleaner'}
                            date={r.requested_date}
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
