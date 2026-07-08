'use client'

import { useActionState, useState } from 'react'
import { updateCleanerProfile } from '@/app/actions/admin'
import CleanerPhotoField from '../cleaner-photo-field'

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
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

type GeocodeStatus = 'idle' | 'loading' | 'found' | 'not_found'

export default function CleanerEditForm({ cleaner }: { cleaner: Cleaner }) {
  const [editState, editAction, editPending] = useActionState(updateCleanerProfile, undefined)

  const [addressStreet,   setAddressStreet]   = useState(cleaner.address_street ?? '')
  const [addressCity,     setAddressCity]     = useState(cleaner.address_city ?? '')
  const [addressProvince, setAddressProvince] = useState(cleaner.address_province ?? '')

  const [homeLat,        setHomeLat]        = useState<number | null>(cleaner.home_lat ?? null)
  const [homeLng,        setHomeLng]        = useState<number | null>(cleaner.home_lng ?? null)
  const [geocodeStatus,  setGeocodeStatus]  = useState<GeocodeStatus>('idle')

  // Latest DOB that still makes the cleaner 18 today.
  const maxDob = (() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 18)
    return d.toISOString().slice(0, 10)
  })()

  async function geocodeAddress() {
    const parts = [addressStreet, addressCity, addressProvince, 'Philippines'].filter(Boolean)
    if (parts.length < 2) return
    setGeocodeStatus('loading')
    try {
      const q = encodeURIComponent(parts.join(', '))
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ph`)
      const data = await res.json()
      if (data[0]) {
        setHomeLat(parseFloat(data[0].lat))
        setHomeLng(parseFloat(data[0].lon))
        setGeocodeStatus('found')
      } else {
        setGeocodeStatus('not_found')
      }
    } catch {
      setGeocodeStatus('not_found')
    }
  }

  return (
    <div className="space-y-6">
      <form action={editAction} className="space-y-4">
        <input type="hidden" name="cleaner_id" value={cleaner.id} />

        {/* ── Personal Information ─────────────────────────────────────── */}
        <SectionLabel>Personal Information</SectionLabel>
        <CleanerPhotoField initialUrl={cleaner.photo_url} required />
        <Field label="Full Name" name="full_name" defaultValue={cleaner.full_name} required />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone" name="phone" type="tel" defaultValue={cleaner.phone} required placeholder="09XX XXX XXXX" maxLength={11} pattern="09[0-9]{9}" hint="Philippine mobile number (09XXXXXXXXX)" />
          <Field label="Date of Birth" name="date_of_birth" type="date" defaultValue={cleaner.date_of_birth} required max={maxDob} hint="Must be at least 18 years old" />
        </div>

        {/* ── Home Address ─────────────────────────────────────────────── */}
        <SectionLabel>Address</SectionLabel>
        <Field
          label="Street Address" name="address_street" required
          value={addressStreet} onChange={e => setAddressStreet(e.target.value)}
          placeholder="123 Sampaguita St., Brgy. Malaya"
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="City / Municipality" name="address_city" required
            value={addressCity} onChange={e => setAddressCity(e.target.value)}
            placeholder="Quezon City"
          />
          <Field
            label="Province" name="address_province" required
            value={addressProvince} onChange={e => setAddressProvince(e.target.value)}
            placeholder="Metro Manila"
          />
        </div>

        {/* ── Geocode button ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={geocodeAddress}
            disabled={geocodeStatus === 'loading' || !addressCity}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-900 disabled:opacity-40 transition-colors"
          >
            {geocodeStatus === 'loading' ? (
              <>
                <span className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                Locating...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Pin Home Location
              </>
            )}
          </button>

          {geocodeStatus === 'found' && homeLat != null && homeLng != null && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Located ({homeLat.toFixed(5)}, {homeLng.toFixed(5)})
            </span>
          )}
          {geocodeStatus === 'not_found' && (
            <span className="text-xs text-red-500">Address not found — try adding more detail.</span>
          )}
          {geocodeStatus === 'idle' && cleaner.home_lat != null && (
            <span className="text-xs text-gray-400">
              Saved: ({cleaner.home_lat.toFixed(5)}, {cleaner.home_lng?.toFixed(5)})
            </span>
          )}
        </div>

        <input type="hidden" name="home_lat" value={homeLat ?? ''} />
        <input type="hidden" name="home_lng" value={homeLng ?? ''} />

        {/* ── Emergency Contact ─────────────────────────────────────────── */}
        <SectionLabel>Emergency Contact</SectionLabel>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Contact Name" name="emergency_contact_name" defaultValue={cleaner.emergency_contact_name} required placeholder="Juan Santos" />
          <Field label="Contact Phone" name="emergency_contact_phone" type="tel" defaultValue={cleaner.emergency_contact_phone} required placeholder="09XX XXX XXXX" maxLength={11} pattern="09[0-9]{9}" />
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
