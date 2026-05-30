'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { fileComplaint } from '@/app/actions/complaints'

export default function NewComplaintPage() {
  const [state, action, pending] = useActionState(fileComplaint, undefined)

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link href="/customer/complaints" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Complaints
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">File a Complaint</h1>
        <p className="text-sm text-gray-500 mt-0.5">Our support team will respond as soon as possible.</p>
      </div>

      <form action={action} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
          <input
            name="subject"
            type="text"
            required
            placeholder="e.g. Cleaner did not arrive on time"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Booking ID <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            name="booking_id"
            type="text"
            placeholder="Paste booking ID if this is about a specific booking"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
          <textarea
            name="message"
            rows={5}
            required
            placeholder="Describe your concern in detail..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Submitting...' : 'Submit complaint'}
        </button>
      </form>
    </div>
  )
}
