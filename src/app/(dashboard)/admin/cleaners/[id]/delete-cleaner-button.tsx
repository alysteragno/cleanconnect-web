'use client'

import { useActionState, useState } from 'react'
import { deleteCleanerAccount } from '@/app/actions/admin'

type State = { error?: string } | undefined

export default function DeleteCleanerButton({ cleanerId }: { cleanerId: string }) {
  const [state, action, pending] = useActionState<State, FormData>(deleteCleanerAccount, undefined)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="space-y-3">
      {/* Trigger — only shown when not in confirm step */}
      {!confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors underline underline-offset-2"
        >
          Delete cleaner account permanently
        </button>
      )}

      {/* Confirmation panel */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          confirming ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
          {/* Warning header */}
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-800">Delete this cleaner account?</p>
              <p className="text-xs text-red-600 mt-0.5 leading-relaxed">
                This immediately revokes their login and permanently erases their job history
                (completed job records). Bookings themselves are not deleted. This cannot be
                undone — consider whether Deactivate is enough before proceeding.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-0.5">
            <form action={action} className="flex-1">
              <input type="hidden" name="cleaner_id" value={cleanerId} />
              <button
                type="submit"
                disabled={pending}
                className="w-full py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                {pending ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : 'Delete Permanently'}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="flex-1 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Nevermind
            </button>
          </div>

          {state?.error && (
            <p className="text-xs text-red-700 bg-red-100 border border-red-200 px-3 py-2 rounded-lg">
              {state.error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
