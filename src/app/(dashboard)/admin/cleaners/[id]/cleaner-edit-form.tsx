'use client'

import { useActionState } from 'react'
import { updateCleanerProfile, toggleCleanerStatus } from '@/app/actions/admin'

type Branch = { id: string; name: string; region: string }

type Props = {
  cleanerId: string
  fullName: string
  phone: string | null
  branchId: string | null
  isActive: boolean
  branches: Branch[]
}

export default function CleanerEditForm({ cleanerId, fullName, phone, branchId, isActive, branches }: Props) {
  const [editState, editAction, editPending] = useActionState(updateCleanerProfile, undefined)
  const [toggleState, toggleAction, togglePending] = useActionState(toggleCleanerStatus, undefined)

  return (
    <div className="space-y-6">
      <form action={editAction} className="space-y-4">
        <input type="hidden" name="cleaner_id" value={cleanerId} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <input
            name="full_name"
            type="text"
            required
            defaultValue={fullName}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            name="phone"
            type="tel"
            defaultValue={phone ?? ''}
            placeholder="+63 9XX XXX XXXX"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch *</label>
          <select
            name="branch_id"
            required
            defaultValue={branchId ?? ''}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="" disabled>Select branch...</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} — {b.region}</option>
            ))}
          </select>
        </div>

        {editState?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{editState.error}</p>
        )}
        {editState?.success && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-lg">{editState.success}</p>
        )}

        <button
          type="submit"
          disabled={editPending}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {editPending ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      <div className="border-t border-gray-100 pt-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Account Status</p>
        <form action={toggleAction}>
          <input type="hidden" name="cleaner_id" value={cleanerId} />
          <input type="hidden" name="is_active" value={String(isActive)} />
          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {isActive ? 'Active' : 'Deactivated'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {isActive ? 'Cleaner can log in and receive job offers.' : 'Cleaner cannot receive new offers.'}
              </p>
            </div>
            <button
              type="submit"
              disabled={togglePending}
              className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                isActive
                  ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                  : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
              }`}
            >
              {togglePending ? '...' : isActive ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
          {toggleState?.success && (
            <p className="mt-2 text-sm text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-lg">{toggleState.success}</p>
          )}
        </form>
      </div>
    </div>
  )
}
