'use client'

import { useActionState } from 'react'
import { updateCleanerProfile, toggleCleanerStatus } from '@/app/actions/admin'

export type Cleaner = {
  id: string
  full_name: string
  phone: string | null
  is_active: boolean
  created_at: string
  address_street: string | null
  address_city: string | null
  address_province: string | null
  date_of_birth: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-5 pb-1 border-t border-gray-100 first:border-t-0 first:pt-0">
      {children}
    </p>
  )
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  placeholder,
  required,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string | null
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required
          ? <span className="text-red-500 ml-0.5">*</span>
          : <span className="text-gray-400 font-normal ml-1">(optional)</span>}
      </label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
      />
    </div>
  )
}

export default function CleanerEditForm({ cleaner }: { cleaner: Cleaner }) {
  const [editState, editAction, editPending] = useActionState(updateCleanerProfile, undefined)
  const [toggleState, toggleAction, togglePending] = useActionState(toggleCleanerStatus, undefined)

  return (
    <div className="space-y-6">
      <form action={editAction} className="space-y-4">
        <input type="hidden" name="cleaner_id" value={cleaner.id} />

        {/* ── Personal Information ─────────────────────────────────────── */}
        <SectionLabel>Personal Information</SectionLabel>
        <Field label="Full Name" name="full_name" defaultValue={cleaner.full_name} required />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone" name="phone" type="tel" defaultValue={cleaner.phone} placeholder="+63 9XX XXX XXXX" />
          <Field label="Date of Birth" name="date_of_birth" type="date" defaultValue={cleaner.date_of_birth} />
        </div>

        {/* ── Home Address ─────────────────────────────────────────────── */}
        <SectionLabel>Address</SectionLabel>
        <Field label="Street Address" name="address_street" defaultValue={cleaner.address_street} placeholder="123 Sampaguita St., Brgy. Malaya" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="City / Municipality" name="address_city" defaultValue={cleaner.address_city} placeholder="Quezon City" />
          <Field label="Province" name="address_province" defaultValue={cleaner.address_province} placeholder="Metro Manila" />
        </div>

        {/* ── Emergency Contact ─────────────────────────────────────────── */}
        <SectionLabel>Emergency Contact</SectionLabel>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Contact Name" name="emergency_contact_name" defaultValue={cleaner.emergency_contact_name} placeholder="Juan Santos" />
          <Field label="Contact Phone" name="emergency_contact_phone" type="tel" defaultValue={cleaner.emergency_contact_phone} placeholder="+63 9XX XXX XXXX" />
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
          className="w-full py-2.5 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 transition-colors"
        >
          {editPending ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      {/* ── Account Status ──────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 pt-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Account Status</p>
        <form action={toggleAction}>
          <input type="hidden" name="cleaner_id" value={cleaner.id} />
          <input type="hidden" name="is_active" value={String(cleaner.is_active)} />
          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {cleaner.is_active ? 'Active' : 'Deactivated'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {cleaner.is_active ? 'Cleaner can log in and receive job offers.' : 'Cleaner cannot receive new offers.'}
              </p>
            </div>
            <button
              type="submit"
              disabled={togglePending}
              className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                cleaner.is_active
                  ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                  : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
              }`}
            >
              {togglePending ? '...' : cleaner.is_active ? 'Deactivate' : 'Reactivate'}
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
