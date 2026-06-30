'use client'

import { useActionState } from 'react'
import { updateRequiredCleaners } from '@/app/actions/admin'

export default function CleanersForm({
  bookingId,
  currentCount,
}: {
  bookingId: string
  currentCount: number
}) {
  const [state, action, pending] = useActionState(updateRequiredCleaners, undefined)

  return (
    <div className="flex justify-between items-start py-2.5 border-b border-gray-50 gap-6">
      <span className="text-sm text-gray-500 shrink-0">Cleaners Required</span>
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="booking_id" value={bookingId} />
        <input
          type="number"
          name="required_cleaners"
          min="1"
          max="10"
          defaultValue={currentCount}
          required
          className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 text-center bg-gray-50 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent focus:bg-white transition-colors"
        />
        <button
          type="submit"
          disabled={pending}
          className="px-3 py-1 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {pending ? '...' : 'Save'}
        </button>
        {state?.error && (
          <span className="text-xs text-red-600">{state.error}</span>
        )}
        {state?.success && (
          <span className="text-xs text-emerald-600">{state.success}</span>
        )}
      </form>
    </div>
  )
}
