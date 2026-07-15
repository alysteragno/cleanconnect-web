'use client'

import { useActionState, useEffect, useState } from 'react'
import { updateSettings } from '@/app/actions/settings'
import { useFormStatus } from 'react-dom'
import { createClient } from '@/utils/supabase/client'
import { PaymentMethodIcon } from '@/components/payment-icons'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-6 py-2.5 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Saving...' : 'Save changes'}
    </button>
  )
}

type Settings = Record<string, string>

export default function AdminSettingsPage() {
  const [state, action] = useActionState(updateSettings, undefined)
  const [settings, setSettings] = useState<Settings>({})

  useEffect(() => {
    createClient()
      .from('settings')
      .select('key, value')
      .then(({ data }) => {
        if (!data) return
        setSettings(Object.fromEntries(data.map((r) => [r.key, r.value])))
      })
  }, [])

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Bank Check Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Shown to customers paying by bank check. All other payment methods are handled
          automatically by PayMongo.
        </p>
      </div>

      <form action={action} className="space-y-6">
        {/* Bank Check */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <PaymentMethodIcon method="bank_check" size={48} />
            <p className="text-sm font-semibold text-gray-700">Bank Check</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Make Check Payable To
            </label>
            <input
              name="check_payable_to"
              type="text"
              defaultValue={settings['check_payable_to'] ?? ''}
              key={settings['check_payable_to']}
              placeholder="Maid For You Cleaning Services"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>
        </div>

        {state?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-lg">
            {state.success}
          </p>
        )}

        <SubmitButton />
      </form>
    </div>
  )
}
