'use client'

import { useActionState, useState } from 'react'
import { convertCustomerToCleaner } from '@/app/actions/admin'
import CleanerPhotoField from '../../cleaners/cleaner-photo-field'

type Props = {
  customerId: string
  fullName: string
  defaultPhone: string | null
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  placeholder,
  max,
  maxLength,
  pattern,
  hint,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string | null
  placeholder?: string
  max?: string
  maxLength?: number
  pattern?: string
  hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}<span className="text-red-500 ml-0.5">*</span>
      </label>
      <input
        name={name}
        type={type}
        required
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        max={max}
        maxLength={maxLength}
        pattern={pattern}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function ConvertToCleanerForm({ customerId, fullName, defaultPhone }: Props) {
  const [state, action, pending] = useActionState(convertCustomerToCleaner, undefined)
  const [open, setOpen] = useState(false)

  // Latest DOB that still makes the person 18 today.
  const maxDob = (() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 18)
    return d.toISOString().slice(0, 10)
  })()

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-sm px-4 py-2 rounded-lg font-medium border border-pink-200 text-pink-600 bg-pink-50 hover:bg-pink-100 transition-colors"
      >
        Convert to Cleaner
      </button>
    )
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Convert ${fullName} into a cleaner account? Their role will change and they will no longer be able to book as a customer.`)) {
          e.preventDefault()
        }
      }}
      className="space-y-4"
    >
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="full_name" value={fullName} />

      <p className="text-xs text-gray-500 leading-relaxed">
        Collect the employment details PH labour requirements make mandatory before
        this person can be dispatched as a cleaner. All fields are required.
      </p>

      <CleanerPhotoField required />

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Phone"
          name="phone"
          type="tel"
          defaultValue={defaultPhone}
          placeholder="09XX XXX XXXX"
          maxLength={11}
          pattern="09[0-9]{9}"
          hint="09XXXXXXXXX"
        />
        <Field
          label="Date of Birth"
          name="date_of_birth"
          type="date"
          max={maxDob}
          hint="Must be at least 18"
        />
      </div>

      <Field label="Street Address" name="address_street" placeholder="123 Sampaguita St., Brgy. Malaya" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="City / Municipality" name="address_city" placeholder="Quezon City" />
        <Field label="Province" name="address_province" placeholder="Metro Manila" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Emergency Contact Name" name="emergency_contact_name" placeholder="Juan Santos" />
        <Field
          label="Emergency Contact Phone"
          name="emergency_contact_phone"
          type="tel"
          placeholder="09XX XXX XXXX"
          maxLength={11}
          pattern="09[0-9]{9}"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 py-2.5 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Converting...' : 'Confirm Conversion'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
