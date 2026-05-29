'use client'

import { useActionState } from 'react'
import { updatePaymentStatus } from '@/app/actions/admin'

const STATUSES = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'refunded', label: 'Refunded' },
]

export default function PaymentForm({
  bookingId,
  currentStatus,
}: {
  bookingId: string
  currentStatus: string
}) {
  const [state, action, pending] = useActionState(updatePaymentStatus, undefined)

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="booking_id" value={bookingId} />
      <div className="grid grid-cols-2 gap-2">
        {STATUSES.map((s) => (
          <label
            key={s.value}
            className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
              currentStatus === s.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="payment_status"
              value={s.value}
              defaultChecked={currentStatus === s.value}
              className="accent-blue-600"
            />
            <span className="text-sm font-medium text-gray-900">{s.label}</span>
          </label>
        ))}
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
        className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {pending ? 'Updating...' : 'Update Payment Status'}
      </button>
    </form>
  )
}
