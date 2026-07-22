'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { toggleCleanerStatus } from '@/app/actions/admin'

type Props = {
  cleanerId: string
  isActive: boolean
  deactivatedAt?: string | null
  /** Upcoming (today or later) assigned jobs — deactivation is blocked while this is > 0. */
  upcomingJobCount: number
  bookingsHref: string
}

export default function CleanerToggleForm({ cleanerId, isActive, deactivatedAt, upcomingJobCount, bookingsHref }: Props) {
  const [state, action, pending] = useActionState(toggleCleanerStatus, undefined)
  // Server-side (toggleCleanerStatus) is what actually enforces this — this
  // is just so the admin sees why the button is disabled instead of
  // clicking it and getting a red error box.
  const blocked = isActive && upcomingJobCount > 0

  return (
    <form action={action}>
      <input type="hidden" name="cleaner_id" value={cleanerId} />
      <input type="hidden" name="is_active" value={String(isActive)} />
      <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {isActive ? 'Active' : 'Deactivated'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {isActive
              ? 'Cleaner can log in and be assigned new jobs.'
              : 'Cleaner cannot log in or be assigned new jobs.'}
          </p>
          {!isActive && deactivatedAt && (
            <p className="text-xs text-gray-400 mt-0.5">
              Deactivated on {new Date(deactivatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending || blocked}
          title={blocked ? `Reassign ${upcomingJobCount} upcoming job${upcomingJobCount > 1 ? 's' : ''} before deactivating.` : undefined}
          className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isActive
              ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
              : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
          }`}
        >
          {pending ? '...' : isActive ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
      {blocked && (
        <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
          <span className="font-semibold">{upcomingJobCount} upcoming assigned job{upcomingJobCount > 1 ? 's' : ''}.</span>{' '}
          Deactivation is blocked until {upcomingJobCount > 1 ? 'they are' : 'it is'} completed{' '}
        </p>
      )}
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
