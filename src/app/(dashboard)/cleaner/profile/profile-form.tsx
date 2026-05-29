'use client'

import { useActionState } from 'react'
import { updateProfile } from '@/app/actions/profile'

type Props = { fullName: string; phone: string | null; email: string }

export default function CleanerProfileForm({ fullName, phone, email }: Props) {
  const [state, action, pending] = useActionState(updateProfile, undefined)

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          disabled
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 bg-gray-50 cursor-not-allowed"
        />
      </div>
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          defaultValue={fullName}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
          Phone <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={phone ?? ''}
          placeholder="+63 9XX XXX XXXX"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-lg">Profile updated.</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {pending ? 'Saving...' : 'Save changes'}
      </button>
    </form>
  )
}
