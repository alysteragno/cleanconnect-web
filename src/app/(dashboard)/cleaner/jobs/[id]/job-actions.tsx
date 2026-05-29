'use client'

import { useActionState } from 'react'
import { useEffect, useState } from 'react'
import { acceptOffer, declineOffer, startJob, completeJob } from '@/app/actions/cleaner'

type Props = {
  assignmentId: string
  assignmentStatus: string
  bookingStatus: string
  paymentMethod: string
  startedAt: string | null
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    function tick() {
      const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
      const h = Math.floor(diff / 3600)
      const m = Math.floor((diff % 3600) / 60)
      const s = diff % 60
      setElapsed(
        [h > 0 ? `${h}h` : null, `${m.toString().padStart(2, '0')}m`, `${s.toString().padStart(2, '0')}s`]
          .filter(Boolean)
          .join(' ')
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return (
    <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-center">
      <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1">Job Timer</p>
      <p className="text-3xl font-bold text-purple-700 font-mono">{elapsed || '—'}</p>
    </div>
  )
}

export default function JobActions({
  assignmentId,
  assignmentStatus,
  bookingStatus,
  paymentMethod,
  startedAt,
}: Props) {
  const [acceptState, acceptAction, acceptPending] = useActionState(acceptOffer, undefined)
  const [declineState, declineAction, declinePending] = useActionState(declineOffer, undefined)
  const [startState, startAction, startPending] = useActionState(startJob, undefined)
  const [completeState, completeAction, completePending] = useActionState(completeJob, undefined)

  const error =
    acceptState?.error || declineState?.error || startState?.error || completeState?.error

  return (
    <div className="space-y-4">
      {/* Timer (in-progress only) */}
      {bookingStatus === 'in_progress' && startedAt && (
        <ElapsedTimer startedAt={startedAt} />
      )}

      {/* Accept / Decline (offered) */}
      {assignmentStatus === 'offered' && (
        <div className="grid grid-cols-2 gap-3">
          <form action={declineAction}>
            <input type="hidden" name="assignment_id" value={assignmentId} />
            <button
              type="submit"
              disabled={declinePending}
              className="w-full py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {declinePending ? 'Declining...' : 'Decline'}
            </button>
          </form>
          <form action={acceptAction}>
            <input type="hidden" name="assignment_id" value={assignmentId} />
            <button
              type="submit"
              disabled={acceptPending}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {acceptPending ? 'Accepting...' : 'Accept Job'}
            </button>
          </form>
        </div>
      )}

      {/* Start Job (accepted + confirmed) */}
      {assignmentStatus === 'accepted' && bookingStatus === 'confirmed' && (
        <form action={startAction}>
          <input type="hidden" name="assignment_id" value={assignmentId} />
          <button
            type="submit"
            disabled={startPending}
            className="w-full py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {startPending ? 'Starting...' : 'Start Job'}
          </button>
        </form>
      )}

      {/* Mark as Completed (in-progress) */}
      {bookingStatus === 'in_progress' && (
        <div className="space-y-3">
          {paymentMethod === 'cash' && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  form="complete-form"
                  name="cash_confirmed"
                  className="mt-0.5 accent-yellow-600"
                />
                <span className="text-sm text-yellow-800">
                  I confirm that I have received the cash payment from the customer.
                </span>
              </label>
            </div>
          )}
          <form id="complete-form" action={completeAction}>
            <input type="hidden" name="assignment_id" value={assignmentId} />
            <button
              type="submit"
              disabled={completePending}
              className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {completePending ? 'Completing...' : 'Mark as Completed'}
            </button>
          </form>
        </div>
      )}

      {/* Completed state */}
      {assignmentStatus === 'completed' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
          <p className="text-sm font-semibold text-green-700">Job Complete</p>
          <p className="text-xs text-green-600 mt-0.5">Great work! This job has been marked as done.</p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
    </div>
  )
}
