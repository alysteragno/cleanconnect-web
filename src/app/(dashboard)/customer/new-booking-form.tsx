'use client'

import { useActionState, useState } from 'react'
import { createBooking } from '@/app/actions/bookings'

type Branch = { id: string; name: string; region: string }

function computeEstimate(sqm: number): { cleaners: number; hours: number; price: number } | null {
  if (!sqm || sqm <= 0) return null
  if (sqm <= 30) return { cleaners: 1, hours: 2, price: 1000 }
  if (sqm <= 60) return { cleaners: 2, hours: 3, price: 1800 }
  if (sqm <= 100) return { cleaners: 3, hours: 4, price: 2500 }
  const extra = Math.ceil((sqm - 100) / 50)
  return { cleaners: 3 + extra, hours: 4 + extra, price: 2500 + extra * 800 }
}

export default function NewBookingForm({ branches }: { branches: Branch[] }) {
  const [state, action, pending] = useActionState(createBooking, undefined)
  const [sqm, setSqm] = useState('')

  const estimate = computeEstimate(parseFloat(sqm) || 0)
  const today = new Date().toISOString().split('T')[0]

  return (
    <form action={action} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="branch_id" className="block text-sm font-medium text-gray-700 mb-1">
            Branch
          </label>
          <select
            id="branch_id"
            name="branch_id"
            required
            defaultValue=""
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="" disabled>
              Select a branch...
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} — {b.region}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="property_sqm" className="block text-sm font-medium text-gray-700 mb-1">
            Property size (sqm)
          </label>
          <input
            id="property_sqm"
            name="property_sqm"
            type="number"
            step="0.1"
            min="1"
            required
            placeholder="e.g. 45"
            value={sqm}
            onChange={(e) => setSqm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="service_date" className="block text-sm font-medium text-gray-700 mb-1">
            Service date
          </label>
          <input
            id="service_date"
            name="service_date"
            type="date"
            required
            min={today}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="service_time" className="block text-sm font-medium text-gray-700 mb-1">
            Service time
          </label>
          <input
            id="service_time"
            name="service_time"
            type="time"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {estimate && (
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">
            Price estimate
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-bold text-blue-800">
                ₱{estimate.price.toLocaleString()}
              </p>
              <p className="text-xs text-blue-600 mt-0.5">Base price</p>
            </div>
            <div>
              <p className="text-xl font-bold text-blue-800">{estimate.cleaners}</p>
              <p className="text-xs text-blue-600 mt-0.5">
                {estimate.cleaners === 1 ? 'Cleaner' : 'Cleaners'}
              </p>
            </div>
            <div>
              <p className="text-xl font-bold text-blue-800">{estimate.hours}h</p>
              <p className="text-xs text-blue-600 mt-0.5">Duration</p>
            </div>
          </div>
        </div>
      )}

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || branches.length === 0}
        className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? 'Booking...' : 'Book service'}
      </button>

      {branches.length === 0 && (
        <p className="text-sm text-gray-400 text-center">No branches available at this time.</p>
      )}
    </form>
  )
}
