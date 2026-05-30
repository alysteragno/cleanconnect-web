'use client'

import { useActionState, useEffect } from 'react'
import { updateSettings } from '@/app/actions/settings'
import { useFormStatus } from 'react-dom'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
        if (data) setSettings(Object.fromEntries(data.map((r) => [r.key, r.value])))
      })
  }, [])

  const field = (key: string, label: string, placeholder?: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        name={key}
        type="text"
        defaultValue={settings[key] ?? ''}
        key={settings[key]}
        placeholder={placeholder}
        required
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Payment Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          These details are shown to customers when they choose GCash or bank transfer.
        </p>
      </div>

      <form action={action} className="space-y-6">
        {/* GCash */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <p className="text-sm font-semibold text-gray-700">GCash</p>
          {field('gcash_number', 'GCash Number', '09XX-XXX-XXXX')}
          {field('gcash_name', 'Account Name', 'Maid For You Cleaning Services')}
        </div>

        {/* Bank Transfer */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <p className="text-sm font-semibold text-gray-700">Bank Transfer</p>
          {field('bank_name', 'Bank Name', 'BDO Unibank')}
          {field('bank_account_number', 'Account Number', 'XXXX-XXXX-XXXX')}
          {field('bank_account_name', 'Account Name', 'Maid For You Cleaning Services')}
        </div>

        {/* Reference note */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-semibold text-gray-700 mb-4">Payment Reference Note</p>
          {field('payment_reference_note', 'Instruction shown to customers', 'Use your Booking ID as the payment reference...')}
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
