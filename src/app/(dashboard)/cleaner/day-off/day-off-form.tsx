'use client'

import { useActionState } from 'react'
import { submitDayOffRequest, type DayOffState } from '@/app/actions/day-off'

const REASON_OPTIONS = [
  'Medical / Health',
  'Personal Leave',
  'Family Emergency',
  'Prior Commitment',
  'Other',
]

export default function DayOffRequestForm() {
  const [state, action, pending] = useActionState<DayOffState, FormData>(submitDayOffRequest, undefined)

  const today = new Date().toISOString().split('T')[0]

  return (
    <form action={action} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Requested Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="requested_date"
            min={today}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason <span className="text-red-500">*</span>
          </label>
          <select
            name="reason"
            required
            defaultValue=""
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
          >
            <option value="" disabled>Select a reason…</option>
            {REASON_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Additional Notes <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          name="notes"
          placeholder="Any additional context for your request…"
          rows={3}
          maxLength={500}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-500"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-lg">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full sm:w-auto px-5 py-2.5 bg-pink-600 text-white text-sm font-medium rounded-lg hover:bg-pink-700 disabled:opacity-50 transition-colors"
      >
        {pending ? 'Submitting…' : 'Submit Request'}
      </button>
    </form>
  )
}
