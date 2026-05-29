'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { createBranch, updateBranch } from '@/app/actions/admin'
import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

type Branch = { id: string; name: string; region: string; contact_number: string | null }
type AdminActionState = { error?: string; success?: string } | undefined

function BranchForm({ branch, onDone }: { branch?: Branch; onDone?: () => void }) {
  const action = branch ? updateBranch : createBranch
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(action, undefined)

  return (
    <form action={formAction} className="space-y-3">
      {branch && <input type="hidden" name="branch_id" value={branch.id} />}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Branch Name *</label>
          <input name="name" type="text" required defaultValue={branch?.name ?? ''} placeholder="e.g. Manila Branch"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Region *</label>
          <input name="region" type="text" required defaultValue={branch?.region ?? ''} placeholder="e.g. Metro Manila"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Contact Number</label>
        <input name="contact_number" type="tel" defaultValue={branch?.contact_number ?? ''} placeholder="+63 2 XXXX XXXX"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {state?.error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-lg">{state.success}</p>}
      <button type="submit" disabled={pending}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {pending ? 'Saving...' : branch ? 'Update Branch' : 'Add Branch'}
      </button>
    </form>
  )
}

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [editing, setEditing] = useState<string | null>(null)

  function load() {
    createClient().from('branches').select('id, name, region, contact_number').order('name')
      .then(({ data }) => setBranches((data ?? []) as Branch[]))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Dashboard</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Branch Management</h1>
      </div>

      {/* Add new */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-900">Add New Branch</p>
        <BranchForm />
      </div>

      {/* Existing branches */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">Existing Branches ({branches.length})</p>
        </div>
        {branches.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No branches yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {branches.map((b) => (
              <div key={b.id} className="p-4">
                {editing === b.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">Editing: {b.name}</p>
                      <button onClick={() => setEditing(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                    <BranchForm branch={b} onDone={() => { setEditing(null); load() }} />
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{b.name}</p>
                      <p className="text-xs text-gray-400">{b.region}{b.contact_number ? ` · ${b.contact_number}` : ''}</p>
                    </div>
                    <button onClick={() => setEditing(b.id)} className="text-xs text-blue-600 hover:underline">Edit</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
