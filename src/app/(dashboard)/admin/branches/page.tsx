'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { updateBranch } from '@/app/actions/admin'
import { createClient } from '@/utils/supabase/client'

type Branch = { id: string; name: string; region: string; contact_number: string | null }
type AdminActionState = { error?: string; success?: string } | undefined

export default function AdminBranchesPage() {
  const [branch, setBranch] = useState<Branch | null>(null)
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(updateBranch, undefined)

  useEffect(() => {
    createClient()
      .from('branches')
      .select('id, name, region, contact_number')
      .single()
      .then(({ data }) => { if (data) setBranch(data as Branch) })
  }, [])

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Dashboard</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Branch Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          CleanConnect operates out of a single branch serving Metro Manila (NCR).
        </p>
      </div>

      {branch ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <p className="text-sm font-semibold text-gray-900">Edit Branch Info</p>
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="branch_id" value={branch.id} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Branch Name *</label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={branch.name}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Region *</label>
                <input
                  name="region"
                  type="text"
                  required
                  defaultValue={branch.region}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contact Number</label>
              <input
                name="contact_number"
                type="tel"
                defaultValue={branch.contact_number ?? ''}
                placeholder="+63 2 XXXX XXXX"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {pending ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-gray-400">Loading branch info...</p>
      )}
    </div>
  )
}
