'use client'

import { useActionState } from 'react'
import { adjustBookingAmount } from '@/app/actions/admin'

export default function AdjustForm({
  bookingId,
  currentAmount,
}: {
  bookingId: string
  currentAmount: number
}) {
  const [state, action, pending] = useActionState(adjustBookingAmount, undefined)

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="booking_id" value={bookingId} />
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">
          Adjusted total (₱) — update if client misreported sqm, sofa size, or added appliances on-site
        </label>
        <input
          type="number"
          name="base_price"
          min="0"
          step="0.01"
          defaultValue={currentAmount}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-lg">{state.success}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 bg-gray-700 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {pending ? 'Updating...' : 'Update Billing Amount'}
      </button>
    </form>
  )
}
