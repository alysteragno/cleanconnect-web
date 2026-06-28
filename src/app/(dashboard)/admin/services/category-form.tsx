'use client'

import { useActionState } from 'react'
import { createCategory } from '@/app/actions/services'

const INPUT = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors'

export default function CategoryForm() {
  const [state, formAction, pending] = useActionState(createCategory, undefined)

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-36">
        <label className="block text-xs font-medium text-gray-700 mb-1">Category Name *</label>
        <input name="name" type="text" required placeholder="e.g. Deep Cleaning" className={INPUT} />
      </div>
      <div className="w-36">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Icon <span className="text-gray-400 font-normal">(Feather)</span>
        </label>
        <input name="icon" type="text" placeholder="e.g. layers" className={`${INPUT} font-mono`} />
      </div>
      <div className="w-24">
        <label className="block text-xs font-medium text-gray-700 mb-1">Order</label>
        <input name="sort_order" type="number" min="0" defaultValue={0} className={INPUT} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 transition-colors shrink-0"
      >
        {pending ? 'Adding…' : 'Add Category'}
      </button>

      {state?.error && (
        <p className="w-full text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="w-full text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
          {state.success}
        </p>
      )}
    </form>
  )
}
