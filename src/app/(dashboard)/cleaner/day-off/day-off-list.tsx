'use client'

import { useActionState } from 'react'
import { cancelDayOffRequest, type DayOffState } from '@/app/actions/day-off'

type DayOffRequest = {
  id: string
  requested_date: string
  reason: string | null
  notes: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  reviewed_at: string | null
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-green-50  text-green-700  border-green-200',
  rejected: 'bg-red-50    text-red-700    border-red-200',
}

const STATUS_LABELS: Record<string, string> = {
  pending:  'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {
    weekday: 'short',
    month:   'long',
    day:     'numeric',
    year:    'numeric',
  })
}

function CancelForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<DayOffState, FormData>(cancelDayOffRequest, undefined)

  return (
    <form action={action}>
      <input type="hidden" name="request_id" value={requestId} />
      {state?.error && (
        <p className="text-xs text-red-500 mt-1">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
      >
        {pending ? 'Cancelling…' : 'Cancel'}
      </button>
    </form>
  )
}

export default function DayOffRequestList({ requests }: { requests: DayOffRequest[] }) {
  if (requests.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8 border border-dashed border-gray-200 rounded-xl">
        No day-off requests yet.
      </p>
    )
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
      {requests.map((r) => {
        const isPast = r.requested_date < today && r.status === 'pending'

        return (
          <div key={r.id} className="px-4 py-4 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{formatDate(r.requested_date)}</span>
                <span className={`text-xs border px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status]}`}>
                  {STATUS_LABELS[r.status]}
                </span>
                {isPast && (
                  <span className="text-xs text-gray-400">(past date)</span>
                )}
              </div>

              {r.reason && (
                <p className="mt-1 text-sm text-gray-500">Reason: {r.reason}</p>
              )}
              {r.notes && (
                <p className="mt-0.5 text-xs text-gray-400 leading-snug">{r.notes}</p>
              )}

              {r.status === 'rejected' && r.admin_notes && (
                <p className="mt-1 text-sm text-red-600">Admin note: {r.admin_notes}</p>
              )}
            </div>

            {r.status === 'pending' && r.requested_date >= today && (
              <div className="shrink-0">
                <CancelForm requestId={r.id} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
