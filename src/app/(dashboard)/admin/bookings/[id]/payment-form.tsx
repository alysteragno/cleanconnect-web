'use client'

import { useActionState, useState } from 'react'
import { updatePaymentStatus } from '@/app/actions/admin'

const STATUSES = [
  { value: 'unpaid',   label: 'Unpaid', dot: 'bg-red-500' },
  { value: 'refunded', label: 'Refunded', dot: 'bg-blue-500'    },
]

export default function PaymentForm({
  bookingId,
}: {
  bookingId: string
}) {
  const [state, action, pending] = useActionState(updatePaymentStatus, undefined)
  const [selected, setSelected] = useState('')

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="booking_id" value={bookingId} />

      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
        Update Status
      </p>

      <div className="grid grid-cols-2 gap-2">
        {STATUSES.map((s) => {
          const isActive = selected === s.value
          return (
            <label
              key={s.value}
              className={`flex flex-col items-center gap-1.5 py-3 px-2 border rounded-xl cursor-pointer transition-all duration-150 text-center select-none ${
                isActive
                  ? 'border-gray-900 bg-gray-900 text-white shadow-sm hover:bg-gray-700 hover:border-gray-700 hover:shadow-md active:scale-[0.97]'
                  : 'border-gray-200 text-gray-600 bg-white hover:border-gray-400 hover:text-gray-900 hover:shadow-sm active:bg-gray-100'
              }`}
            >
              <input
                type="radio"
                name="payment_status"
                value={s.value}
                checked={isActive}
                onChange={() => setSelected(s.value)}
                className="sr-only"
              />
              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-white/60' : s.dot}`} />
              <span className="text-xs font-semibold">{s.label}</span>
            </label>
          )
        })}
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
        className="w-full py-2.5 bg-pink-600 text-white rounded-xl text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 transition-colors"
      >
        {pending ? 'Updating...' : 'Update Payment Status'}
      </button>
    </form>
  )
}
