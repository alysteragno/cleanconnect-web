'use client'

import { useActionState, useState } from 'react'
import { updateCleanerProfile } from '@/app/actions/admin'
import CleanerPhotoField from '../cleaner-photo-field'

// Mirrors NAME_TEXT_RE / ADDRESS_TEXT_RE in src/app/actions/admin.ts —
// strips <, @, %, and other markup/injection characters as typed.
const NAME_UNSAFE_CHARS_RE = /[^a-zA-ZÀ-ÿ' .-]/g
function sanitizeNameInput(value: string) {
  return value.replace(NAME_UNSAFE_CHARS_RE, '')
}
const ADDRESS_UNSAFE_CHARS_RE = /[^a-zA-Z0-9À-ÿ.,'#\-/() ]/g
function sanitizeAddressInput(value: string) {
  return value.replace(ADDRESS_UNSAFE_CHARS_RE, '')
}
// PH mobile numbers are digits only — pattern only catches this at submit
// time, and type="tel" doesn't block keystrokes on its own.
const PHONE_UNSAFE_CHARS_RE = /[^0-9]/g
function sanitizePhoneInput(value: string) {
  return value.replace(PHONE_UNSAFE_CHARS_RE, '')
}

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
  home_lat: number | null
  home_lng: number | null
  photo_url: string | null
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
  value,
  onChange,
  placeholder,
  required,
  max,
  maxLength,
  pattern,
  hint,
  sanitize,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string | null
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  required?: boolean
  max?: string
  maxLength?: number
  pattern?: string
  hint?: string
  /** Strips disallowed characters as the user types (imperative — works even on uncontrolled inputs). */
  sanitize?: (value: string) => string
}) {
  const isControlled = value !== undefined
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
        {...(isControlled
          ? { value: value ?? '', onChange }
          : { defaultValue: defaultValue ?? '' }
        )}
        required={required}
        placeholder={placeholder}
        max={max}
        maxLength={maxLength}
        pattern={pattern}
        onChangeCapture={sanitize ? (e) => { e.currentTarget.value = sanitize(e.currentTarget.value) } : undefined}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function CleanerEditForm({ cleaner }: { cleaner: Cleaner }) {
  const [editState, editAction, editPending] = useActionState(updateCleanerProfile, undefined)

  const [addressStreet,   setAddressStreet]   = useState(cleaner.address_street ?? '')
  const [addressCity,     setAddressCity]     = useState(cleaner.address_city ?? '')
  const [addressProvince, setAddressProvince] = useState(cleaner.address_province ?? '')

  // Latest DOB that still makes the cleaner 18 today.
  const maxDob = (() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 18)
    return d.toISOString().slice(0, 10)
  })()

  return (
    <div className="space-y-6">
      <form action={editAction} className="space-y-4">
        <input type="hidden" name="cleaner_id" value={cleaner.id} />

        {/* ── Personal Information ─────────────────────────────────────── */}
        <SectionLabel>Personal Information</SectionLabel>
        <CleanerPhotoField initialUrl={cleaner.photo_url} required />
        <Field label="Full Name" name="full_name" defaultValue={cleaner.full_name} required sanitize={sanitizeNameInput} maxLength={100} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone" name="phone" type="tel" defaultValue={cleaner.phone} required placeholder="09XX XXX XXXX" maxLength={11} pattern="09[0-9]{9}" hint="Philippine mobile number (09XXXXXXXXX)" sanitize={sanitizePhoneInput} />
          <Field label="Date of Birth" name="date_of_birth" type="date" defaultValue={cleaner.date_of_birth} required max={maxDob} hint="Must be at least 18 years old" />
        </div>

        {/* ── Home Address ─────────────────────────────────────────────── */}
        <SectionLabel>Address</SectionLabel>
        <Field
          label="Street Address" name="address_street" required
          value={addressStreet} onChange={e => setAddressStreet(e.target.value)}
          placeholder="123 Sampaguita St., Brgy. Malaya"
          sanitize={sanitizeAddressInput} maxLength={200}
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="City / Municipality" name="address_city" required
            value={addressCity} onChange={e => setAddressCity(e.target.value)}
            placeholder="Quezon City"
            sanitize={sanitizeAddressInput} maxLength={100}
          />
          <Field
            label="Province" name="address_province" required
            value={addressProvince} onChange={e => setAddressProvince(e.target.value)}
            placeholder="Metro Manila"
            sanitize={sanitizeAddressInput} maxLength={100}
          />
        </div>

        {/*
          Pin Home Location (client-side Nominatim geocoding) was removed as
          redundant — dispatch proximity already prefers the cleaner's live
          last_seen ping over this, only falling back to home_lat/lng when
          that's stale (src/lib/ai-assignment.ts). These hidden inputs just
          round-trip whatever was already saved so existing values aren't
          wiped on an unrelated profile edit; updateCleanerProfile omits the
          columns from its UPDATE entirely if they don't parse, so there is
          no longer any UI path that writes new home coordinates.
        */}
        <input type="hidden" name="home_lat" value={cleaner.home_lat ?? ''} />
        <input type="hidden" name="home_lng" value={cleaner.home_lng ?? ''} />

        {/* ── Emergency Contact ─────────────────────────────────────────── */}
        <SectionLabel>Emergency Contact</SectionLabel>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Contact Name" name="emergency_contact_name" defaultValue={cleaner.emergency_contact_name} required placeholder="Juan Santos" sanitize={sanitizeNameInput} maxLength={100} />
          <Field label="Contact Phone" name="emergency_contact_phone" type="tel" defaultValue={cleaner.emergency_contact_phone} required placeholder="09XX XXX XXXX" maxLength={11} pattern="09[0-9]{9}" sanitize={sanitizePhoneInput} />
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

    </div>
  )
}
