'use client'

import { useActionState, useState } from 'react'
import { reviewDayOffRequest, type DayOffState } from '@/app/actions/day-off'

type Request = {
  id: string
  requested_date: string
  reason: string | null
  created_at: string
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {
    weekday: 'short',
    month:   'long',
    day:     'numeric',
    year:    'numeric',
  })
}

function RequestRow({ req }: { req: Request }) {
  const [state, action, pending] = useActionState<DayOffState, FormData>(reviewDayOffRequest, undefined)
  const [showNotes, setShowNotes] = useState(false)

  return (
    <div className="flex flex-col gap-2 px-4 py-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-medium text-gray-900">{formatDate(req.requested_date)}</p>
          {req.reason && <p className="text-xs text-gray-500 mt-0.5">Reason: {req.reason}</p>}
        </div>
      </div>

      <form action={action} className="space-y-2">
        <input type="hidden" name="request_id" value={req.id} />

        {showNotes && (
          <textarea
            name="admin_notes"
            placeholder="Optional note to cleaner…"
            rows={2}
            maxLength={300}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            name="decision"
            value="approved"
            disabled={pending}
            className="px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {pending ? '…' : 'Approve'}
          </button>
          <button
            type="submit"
            name="decision"
            value="rejected"
            disabled={pending}
            className="px-4 py-1.5 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
          >
            {pending ? '…' : 'Reject'}
          </button>
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showNotes ? 'Hide note' : '+ Add note'}
          </button>
        </div>

        {state?.error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-2 py-1.5 rounded-lg">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-100 px-2 py-1.5 rounded-lg">
            {state.success}
          </p>
        )}
      </form>
    </div>
  )
}

export default function DayOffReviewPanel({ requests }: { requests: Request[] }) {
  if (requests.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
        No pending day-off requests.
      </p>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
      {requests.map((r) => (
        <RequestRow key={r.id} req={r} />
      ))}
    </div>
  )
}
