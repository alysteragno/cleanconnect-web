'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { createCleanerAccount } from '@/app/actions/admin'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'


export default function NewCleanerPage() {
  const [state, action, pending] = useActionState(createCleanerAccount, undefined)
 
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link href="/admin/cleaners" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Cleaners
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Add Cleaner</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Creates a login account for the cleaner with the role &ldquo;cleaner&rdquo;.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form action={action} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              name="full_name"
              type="text"
              required
              placeholder="Maria Santos"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              name="email"
              type="email"
              required
              placeholder="maria@cleaningladyph.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Min. 8 characters"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              name="phone"
              type="tel"
              placeholder="+63 9XX XXX XXXX"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
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
            className="w-full py-2.5 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 transition-colors"
          >
            {pending ? 'Creating account...' : 'Create Cleaner Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
