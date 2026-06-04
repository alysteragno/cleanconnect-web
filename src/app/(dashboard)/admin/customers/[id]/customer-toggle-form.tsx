'use client'

import { useActionState } from 'react'
import { toggleCustomerStatus } from '@/app/actions/admin'

type Props = {
  customerId: string
  isActive: boolean
}

export default function CustomerToggleForm({ customerId, isActive }: Props) {
  const [state, action, pending] = useActionState(toggleCustomerStatus, undefined)

  return (
    <form action={action}>
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="is_active" value={String(isActive)} />
      <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {isActive ? 'Active' : 'Deactivated'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {isActive
              ? 'Customer can log in and make bookings.'
              : 'Customer cannot log in or make new bookings.'}
          </p>
        </div>
        <button
          type="submit"
          disabled={pending}
          className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
            isActive
              ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
              : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
          }`}
        >
          {pending ? '...' : isActive ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
      {state?.success && (
        <p className="mt-2 text-sm text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-lg">
          {state.success}
        </p>
      )}
      {state?.error && (
        <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          {state.error}
        </p>
      )}
    </form>
  )
}
