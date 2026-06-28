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

      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
        Billing Adjustment
      </p>
      <p className="text-xs text-gray-400 leading-relaxed">
        Override the computed amount if scope changed on-site (e.g. mis-reported sqm, added appliances).
      </p>

      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400 pointer-events-none select-none">
          ₱
        </span>
        <input
          type="number"
          name="base_price"
          min="0"
          step="0.01"
          defaultValue={currentAmount}
          required
          className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent focus:bg-white transition-colors"
        />
      </div>

      {state?.error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">{state.success}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50 transition-all duration-150"
      >
        {pending ? 'Saving...' : 'Save New Amount'}
      </button>
    </form>
  )
}
