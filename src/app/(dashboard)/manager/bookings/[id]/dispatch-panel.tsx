'use client'

import { useActionState, useState } from 'react'
import { dispatchCleaners, forceAssignCleaner, cancelBooking } from '@/app/actions/manager'
import AIDispatchButton from './ai-dispatch-button'

type Cleaner = { id: string; full_name: string; phone: string | null }
type Assignment = { cleaner_id: string; status: string; profiles: { full_name: string } | null }

type Props = {
  bookingId: string
  bookingStatus: string
  cleaners: Cleaner[]
  assignments: Assignment[]
}

const ASSIGNMENT_BADGE: Record<string, string> = {
  offered: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  accepted: 'bg-green-50 text-green-700 border-green-200',
  declined: 'bg-red-50 text-red-600 border-red-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
}

export default function DispatchPanel({ bookingId, bookingStatus, cleaners, assignments }: Props) {
  const [dispatchState, dispatchAction, dispatchPending] = useActionState(dispatchCleaners, undefined)
  const [forceState, forceAction, forcePending] = useActionState(forceAssignCleaner, undefined)
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelBooking, undefined)
  const [selected, setSelected] = useState<string[]>([])
  const [showManual, setShowManual] = useState(false)

  const alreadyAssigned = new Set(assignments.map((a) => a.cleaner_id))
  const availableForDispatch = cleaners.filter((c) => !alreadyAssigned.has(c.id))
  const isClosed = bookingStatus === 'completed' || bookingStatus === 'cancelled'

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <div className="space-y-5">

      {/* Current assignment status */}
      {assignments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Assignment Status
          </p>
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.cleaner_id} className="flex items-center justify-between px-3 py-2 border border-gray-100 rounded-lg">
                <span className="text-sm text-gray-900">{a.profiles?.full_name ?? 'Cleaner'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${ASSIGNMENT_BADGE[a.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isClosed && (
        <>
          {/* ── PRIMARY: AI Dispatch ──────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              AI Dispatch
            </p>
            <p className="text-xs text-gray-500 mb-3">
              The AI filters by day-offs and schedule conflicts, then ranks eligible cleaners
              by workload and proximity before sending offers.
            </p>
            <AIDispatchButton bookingId={bookingId} />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          {/* ── SECONDARY: Manual dispatch ───────────────────────────── */}
          <div>
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 hover:text-gray-700 transition-colors"
            >
              Manual Dispatch
              <span className="text-gray-400">{showManual ? '▲' : '▼'}</span>
            </button>

            {showManual && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-gray-400">
                  Manually select cleaners to send offers to. Use this to override the AI.
                </p>

                {availableForDispatch.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {availableForDispatch.map((c) => (
                        <label
                          key={c.id}
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            selected.includes(c.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.includes(c.id)}
                            onChange={() => toggle(c.id)}
                            className="accent-blue-600"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                            {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                          </div>
                        </label>
                      ))}
                    </div>

                    <form action={dispatchAction}>
                      <input type="hidden" name="booking_id" value={bookingId} />
                      {selected.map((id) => (
                        <input key={id} type="hidden" name="cleaner_ids" value={id} />
                      ))}
                      <button
                        type="submit"
                        disabled={dispatchPending || selected.length === 0}
                        className="w-full py-2.5 bg-gray-700 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
                      >
                        {dispatchPending ? 'Sending...' : `Send Offer to ${selected.length || '—'} Cleaner(s)`}
                      </button>
                    </form>

                    {dispatchState?.success && (
                      <p className="text-sm text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-lg">{dispatchState.success}</p>
                    )}
                    {dispatchState?.error && (
                      <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{dispatchState.error}</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-400">All branch cleaners have already been offered this job.</p>
                )}
              </div>
            )}
          </div>

          {/* ── Force-assign override ─────────────────────────────────── */}
          <div className="pt-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Force Assign (Override)
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Directly confirms a cleaner without waiting for acceptance.
            </p>
            <form action={forceAction} className="flex gap-2">
              <input type="hidden" name="booking_id" value={bookingId} />
              <select
                name="cleaner_id"
                required
                defaultValue=""
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="" disabled>Select cleaner...</option>
                {cleaners.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={forcePending}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {forcePending ? '...' : 'Assign'}
              </button>
            </form>
            {forceState?.error && (
              <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{forceState.error}</p>
            )}
          </div>

          {/* Cancel */}
          {(bookingStatus === 'pending' || bookingStatus === 'confirmed') && (
            <div className="border-t border-gray-100 pt-3">
              <form action={cancelAction}>
                <input type="hidden" name="booking_id" value={bookingId} />
                <button type="submit" disabled={cancelPending}
                  className="text-sm text-red-500 hover:text-red-700 transition-colors disabled:opacity-50">
                  {cancelPending ? 'Cancelling...' : 'Cancel this booking'}
                </button>
              </form>
              {cancelState?.error && <p className="mt-1 text-xs text-red-600">{cancelState.error}</p>}
            </div>
          )}
        </>
      )}

      {isClosed && (
        <p className="text-sm text-gray-400 text-center py-4">
          This booking is {bookingStatus}. No further actions available.
        </p>
      )}
    </div>
  )
}
