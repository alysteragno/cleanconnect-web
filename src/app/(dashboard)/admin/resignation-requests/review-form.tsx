'use client'

import { useActionState, useState } from 'react'
import { reviewResignationRequest, type ResignationState } from '@/app/actions/resignations'

export default function ReviewModal({
  requestId,
  cleanerName,
  reason,
  upcomingJobCount,
}: {
  requestId: string
  cleanerName: string
  reason: string | null
  upcomingJobCount: number
}) {
  const [state, action, pending] = useActionState<ResignationState, FormData>(reviewResignationRequest, undefined)
  const [open, setOpen] = useState(false)

  if (state?.success) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Acknowledged
      </span>
    )
  }

  return (
    <>
      {/* Trigger button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 active:scale-95 transition-all"
        >
          Acknowledge
        </button>
      </div>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <h3 className="text-base font-bold text-gray-900">Acknowledge Resignation Request</h3>
                </div>
                <p className="text-sm text-gray-500 pl-4">
                  <span className="font-semibold text-gray-700">{cleanerName}</span>
                  {reason ? ` · ${reason}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="text-gray-300 hover:text-gray-600 transition-colors shrink-0 disabled:opacity-40"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* This moves the request to "In Progress" and notifies the cleaner —
                it does NOT deactivate their account. Resignation is only ever
                finalized in person at the office; the account is deactivated
                separately from the cleaner's own profile page once they show up,
                which is where upcoming jobs actually get enforced. */}
            <div className="flex items-start gap-2.5 px-3.5 py-3 bg-blue-50 border border-blue-200 rounded-xl">
              <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-blue-800 leading-relaxed">
                This does not deactivate {cleanerName}&rsquo;s account. It moves the request to{' '}
                <span className="font-semibold">In Progress</span> and sends them the note below —
                the account is deactivated separately, in person at the office.
                {upcomingJobCount > 0 && (
                  <>
                    {' '}They currently have <span className="font-semibold">{upcomingJobCount} upcoming assigned job{upcomingJobCount > 1 ? 's' : ''}</span>,
                    which will need reassigning before the account can be deactivated later.
                  </>
                )}
              </p>
            </div>

            {/* Form */}
            <form action={action} className="space-y-4">
              <input type="hidden" name="request_id" value={requestId} />

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Note to cleaner
                  <span className="ml-1 text-red-500 font-normal">(required)</span>
                </label>
                <textarea
                  name="admin_note"
                  required
                  placeholder="E.g. Come to the office on [date] to complete your resignation and process your final pay."
                  rows={3}
                  maxLength={300}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent transition-colors placeholder:text-gray-300"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Let them know what happens next — e.g. when to come in and finalize things at the office.
                </p>
              </div>

              {state?.error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg">
                  {state.error}
                </p>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:border-gray-400 hover:text-gray-900 active:bg-gray-100 disabled:opacity-40 transition-all duration-150"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-[2] py-2.5 text-white text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50 transition-all duration-150 flex items-center justify-center gap-2"
                >
                  {pending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                      Processing…
                    </>
                  ) : (
                    'Confirm Acknowledge'
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
