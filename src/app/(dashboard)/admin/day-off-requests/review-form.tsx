'use client'

import { useActionState, useState } from 'react'
import { reviewDayOffRequest, type DayOffState } from '@/app/actions/day-off'

export default function ReviewModal({
  requestId,
  cleanerName,
  date,
}: {
  requestId: string
  cleanerName: string
  date: string
}) {
  const [state, action, pending] = useActionState<DayOffState, FormData>(reviewDayOffRequest, undefined)
  const [modal, setModal] = useState<'approve' | 'reject' | null>(null)

  function fmtDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {
      weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
    })
  }

  if (state?.success) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Done
      </span>
    )
  }

  return (
    <>
      {/* Trigger buttons */}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setModal('approve')}
          className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 active:scale-95 transition-all"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => setModal('reject')}
          className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold rounded-lg hover:bg-red-100 active:scale-95 transition-all"
        >
          Reject
        </button>
      </div>

      {/* Modal overlay */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className={`w-2 h-2 rounded-full ${modal === 'approve' ? 'bg-green-500' : 'bg-red-400'}`} />
                  <h3 className="text-base font-bold text-gray-900">
                    {modal === 'approve' ? 'Approve Day-Off Request' : 'Reject Day-Off Request'}
                  </h3>
                </div>
                <p className="text-sm text-gray-500 pl-4">
                  <span className="font-semibold text-gray-700">{cleanerName}</span>
                  {' · '}
                  {fmtDate(date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={pending}
                className="text-gray-300 hover:text-gray-600 transition-colors shrink-0 disabled:opacity-40"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form action={action} className="space-y-4">
              <input type="hidden" name="request_id" value={requestId} />
              <input type="hidden" name="decision" value={modal === 'approve' ? 'approved' : 'rejected'} />

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Note to cleaner
                  <span className="ml-1 text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  name="admin_notes"
                  placeholder={
                    modal === 'approve'
                      ? 'E.g. Enjoy your day off! Please coordinate with the team.'
                      : 'E.g. We need full coverage on this date. Please reschedule.'
                  }
                  rows={3}
                  maxLength={300}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent transition-colors placeholder:text-gray-300"
                />
              </div>

              {state?.error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg">
                  {state.error}
                </p>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  disabled={pending}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:border-gray-400 hover:text-gray-900 active:bg-gray-100 disabled:opacity-40 transition-all duration-150"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className={[
                    'flex-[2] py-2.5 text-white text-sm font-semibold rounded-xl',
                    'active:scale-[0.98] disabled:opacity-50 transition-all duration-150',
                    'flex items-center justify-center gap-2',
                    modal === 'approve'
                      ? 'bg-green-600 hover:bg-green-700 hover:shadow-md'
                      : 'bg-red-600 hover:bg-red-700 hover:shadow-md',
                  ].join(' ')}
                >
                  {pending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                      Processing…
                    </>
                  ) : modal === 'approve' ? (
                    'Confirm Approve'
                  ) : (
                    'Confirm Reject'
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </>
  )
}
