import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import { getUpcomingAssignedJobCounts } from '@/lib/cleaner-jobs'
import ReviewModal from './review-form'

type CleanerInfo = {
  id: string
  full_name: string
  phone: string | null
  photo_url: string | null
}

type ReviewerInfo = { id: string; full_name: string } | null

type ResignationRequest = {
  id: string
  reason: string | null
  status: 'pending' | 'in_progress' | 'approved' | 'rejected'
  admin_note: string | null
  reviewed_at: string | null
  created_at: string
  cleaner: CleanerInfo | null
  reviewer: ReviewerInfo
}

// 'approved' / 'rejected' stay here only to render correctly for any rows
// written before the workflow changed — the web admin flow now only ever
// writes 'pending' and 'in_progress' (see src/app/actions/resignations.ts).
const STATUS_META: Record<string, { pill: string; dot: string; label: string }> = {
  pending:     { pill: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400', label: 'Pending'     },
  in_progress: { pill: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-500',   label: 'In Progress' },
  approved:    { pill: 'bg-green-50 text-green-700 border-green-200',   dot: 'bg-green-500',  label: 'Approved'    },
  rejected:    { pill: 'bg-red-50 text-red-700 border-red-200',         dot: 'bg-red-400',    label: 'Rejected'    },
}

function fmtTs(ts: string) {
  return new Date(ts).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
  })
}

const TABS = ['pending', 'in_progress'] as const

export default async function AdminResignationRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: rawStatus } = await searchParams
  const status = TABS.includes(rawStatus as (typeof TABS)[number]) ? (rawStatus as (typeof TABS)[number]) : 'pending'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') redirect('/login')

  const basePath = await getBasePath()
  const adminClient = createAdminClient()

  // Fetch every request once (small table) so tab counts are always accurate
  // regardless of which tab is selected — same approach as the Active/
  // Archived split on the Complaints and Cleaners pages.
  const { data: rows } = await adminClient
    .from('cleaner_resignation_requests')
    .select(`
      id,
      reason,
      status,
      admin_note,
      reviewed_at,
      created_at,
      cleaner:profiles!cleaner_id (
        id,
        full_name,
        phone,
        photo_url
      ),
      reviewer:profiles!reviewed_by (
        id,
        full_name
      )
    `)
    .order('created_at', { ascending: false })

  const allRequests = (rows ?? []) as unknown as ResignationRequest[]
  const counts = {
    pending:     allRequests.filter((r) => r.status === 'pending').length,
    in_progress: allRequests.filter((r) => r.status === 'in_progress').length,
  }
  const requests = allRequests.filter((r) => r.status === status)

  const cleanerIds = [...new Set(requests.map((r) => r.cleaner?.id).filter((id): id is string => !!id))]
  const upcomingCounts = await getUpcomingAssignedJobCounts(adminClient, cleanerIds)

  const tabClass = (isActive: boolean) =>
    `text-sm font-medium pb-2 -mb-px border-b-2 transition-colors ${
      isActive
        ? 'border-pink-500 text-gray-900'
        : 'border-transparent text-gray-400 hover:text-gray-600'
    }`

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

      <Link href={`${basePath}/cleaners`} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Cleaners</Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resignation Requests</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review resignation requests. Acknowledging notifies the cleaner — the account itself
            is deactivated separately, in person at the office.
          </p>
        </div>
        {counts.pending > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm font-semibold rounded-full w-fit">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            {counts.pending} pending
          </span>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-6 border-b border-gray-200">
        <Link href={`${basePath}/resignation-requests?status=pending`} className={tabClass(status === 'pending')}>
          Pending <span className="text-gray-300">({counts.pending})</span>
        </Link>
        <Link href={`${basePath}/resignation-requests?status=in_progress`} className={tabClass(status === 'in_progress')}>
          In Progress <span className="text-gray-300">({counts.in_progress})</span>
        </Link>
      </div>

      {/* Table */}
      {requests.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl bg-white">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">No requests found for the selected filter.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Cleaner</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Upcoming Jobs</th>
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
                  const upcomingCount = r.cleaner ? (upcomingCounts.get(r.cleaner.id) ?? 0) : 0
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">

                      {/* Cleaner */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 min-w-[160px]">
                          {r.cleaner?.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.cleaner.photo_url}
                              alt={r.cleaner.full_name ?? 'Cleaner'}
                              className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-pink-100 text-pink-700 text-xs font-bold flex items-center justify-center shrink-0 select-none">
                              {initials}
                            </div>
                          )}
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

                      {/* Reason + admin note */}
                      <td className="px-5 py-4 max-w-[220px]">
                        <span className="text-sm text-gray-600">
                          {r.reason ?? <span className="text-gray-300">—</span>}
                        </span>
                        {r.status !== 'pending' && r.admin_note && (
                          <p className="text-xs text-gray-400 mt-0.5 italic leading-snug">
                            Admin: {r.admin_note}
                          </p>
                        )}
                      </td>

                      {/* Upcoming assigned jobs — the reassignment signal */}
                      <td className="px-5 py-4">
                        {upcomingCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                            {upcomingCount} job{upcomingCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">None</span>
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
                              {r.status === 'in_progress' ? (
                                <span className="text-blue-600">Acknowledged by</span>
                              ) : r.status === 'approved' ? (
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
                            reason={r.reason}
                            upcomingJobCount={upcomingCount}
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
