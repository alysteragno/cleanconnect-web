'use client'

import { useActionState } from 'react'
import { addCleanerDayOff, removeCleanerDayOff } from '@/app/actions/admin'

type DayOff = { id: string; unavailable_date: string }
type State = { error?: string; success?: string } | undefined

export default function AvailabilityPanel({
  cleanerId,
  dayOffs,
}: {
  cleanerId: string
  dayOffs: DayOff[]
}) {
  const [addState, addAction, addPending] = useActionState<State, FormData>(addCleanerDayOff, undefined)
  const [removeState, removeAction, removePending] = useActionState<State, FormData>(removeCleanerDayOff, undefined)

  const today = new Date().toISOString().split('T')[0]
  const sorted = [...dayOffs].sort((a, b) => a.unavailable_date.localeCompare(b.unavailable_date))
  const upcoming = sorted.filter((d) => d.unavailable_date >= today)
  const pastCount = sorted.length - upcoming.length

  return (
    <div className="space-y-4">

      {/* Add day-off form */}
      <form action={addAction} className="flex gap-2">
        <input type="hidden" name="cleaner_id" value={cleanerId} />
        <input
          type="date"
          name="unavailable_date"
          min={today}
          required
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
        />
        <button
          type="submit"
          disabled={addPending}
          className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {addPending ? 'Adding…' : '+ Add Day-off'}
        </button>
      </form>

      {addState?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{addState.error}</p>
      )}
      {addState?.success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-lg">{addState.success}</p>
      )}
      {removeState?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{removeState.error}</p>
      )}

      {/* Upcoming day-offs list */}
      {upcoming.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
          {upcoming.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-900">{formatDate(d.unavailable_date)}</span>
                {d.unavailable_date === today && (
                  <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded-full font-medium">
                    Today
                  </span>
                )}
              </div>
              <form action={removeAction}>
                <input type="hidden" name="availability_id" value={d.id} />
                <input type="hidden" name="cleaner_id" value={cleanerId} />
                <button
                  type="submit"
                  disabled={removePending}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
                >
                  Remove
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
          No upcoming day-offs scheduled.
        </p>
      )}

      {pastCount > 0 && (
        <p className="text-xs text-gray-400">{pastCount} past day-off{pastCount !== 1 ? 's' : ''} not shown.</p>
      )}
    </div>
  )
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
