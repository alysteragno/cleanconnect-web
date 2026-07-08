'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { createCleanerAccount } from '@/app/actions/admin'
import CleanerPhotoField from '../cleaner-photo-field'

const PASSWORD_REQUIREMENTS = [
  { label: 'Minimum 8 characters',           test: (p: string) => p.length >= 8 },
  { label: 'At least one uppercase letter',  test: (p: string) => /[A-Z]/.test(p) },
  { label: 'At least one lowercase letter',  test: (p: string) => /[a-z]/.test(p) },
  { label: 'At least one number',            test: (p: string) => /[0-9]/.test(p) },
  { label: 'At least one special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2 pb-1 border-t border-gray-100 first:border-t-0 first:pt-0">
      {children}
    </p>
  )
}

function Field({
  label,
  name,
  type = 'text',
  placeholder,
  required,
  min,
  max,
  maxLength,
  pattern,
  hint,
  value,
  onChange,
  revealable,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
  min?: number
  max?: string
  maxLength?: number
  pattern?: string
  hint?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  revealable?: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  const isPassword = revealable && type === 'password'
  const effectiveType = isPassword ? (revealed ? 'text' : 'password') : type

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        {!required && <span className="text-gray-400 font-normal ml-1">(optional)</span>}
      </label>
      <div className="relative">
        <input
          name={name}
          type={effectiveType}
          required={required}
          placeholder={placeholder}
          minLength={min}
          max={max}
          maxLength={maxLength}
          pattern={pattern}
          value={value}
          onChange={onChange}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 ${isPassword ? 'pr-10' : ''}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed(v => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors p-1"
          >
            {revealed ? (
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 2l16 16M8.5 8.6a2 2 0 002.8 2.8" />
                <path d="M6.5 4.9A8.9 8.9 0 0110 4c4 0 7.3 2.6 8.5 6a10 10 0 01-2 3M4 6a10 10 0 00-2.5 4c1.2 3.4 4.5 6 8.5 6a8.9 8.9 0 003.3-.6" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6z" />
                <circle cx="10" cy="10" r="2.5" />
              </svg>
            )}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function NewCleanerPage() {
  const [state, action, pending] = useActionState(createCleanerAccount, undefined)
  const [password, setPassword] = useState('')
  const typed = password.length > 0

  // Latest date of birth that still makes the cleaner 18 today.
  const maxDob = (() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 18)
    return d.toISOString().slice(0, 10)
  })()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/cleaners" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Cleaners
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Add Cleaner</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Creates a login account and employment profile for the new cleaner.
          All fields are required for compliance with PH labour requirements.
        </p>
      </div>

      <form action={action} className="space-y-5">
        {/* ── Account Credentials ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <SectionLabel>Account Credentials</SectionLabel>
          <Field label="Email" name="email" type="email" required placeholder="maria@cleaningladyph.com" />

          <div>
            <Field
              label="Password"
              name="password"
              type="password"
              required
              revealable
              placeholder="Create a strong password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <ul className="mt-2 space-y-1">
              {PASSWORD_REQUIREMENTS.map(req => {
                const met = typed && req.test(password)
                return (
                  <li
                    key={req.label}
                    className={`flex items-center gap-2 text-xs transition-colors ${met ? 'text-emerald-600' : 'text-gray-400'}`}
                  >
                    <span className="w-3 text-center font-bold">{met ? '✓' : '○'}</span>
                    {req.label}
                  </li>
                )
              })}
            </ul>
          </div>

          <Field
            label="Confirm Password"
            name="confirm_password"
            type="password"
            required
            revealable
            placeholder="Re-enter the password"
          />
        </div>

        {/* ── Personal Information ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <SectionLabel>Personal Information</SectionLabel>
          <CleanerPhotoField required />
          <Field label="Full Name" name="full_name" required placeholder="Maria Santos" />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Phone"
              name="phone"
              type="tel"
              required
              placeholder="09XX XXX XXXX"
              maxLength={11}
              pattern="09[0-9]{9}"
              hint="Philippine mobile number (09XXXXXXXXX)"
            />
            <Field
              label="Date of Birth"
              name="date_of_birth"
              type="date"
              required
              max={maxDob}
              hint="Cleaner must be at least 18 years old"
            />
          </div>
        </div>

        {/* ── Home Address ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <SectionLabel>Address</SectionLabel>
          <Field label="Street Address" name="address_street" required placeholder="123 Sampaguita St., Brgy. Malaya" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="City / Municipality" name="address_city" required placeholder="Quezon City" />
            <Field label="Province" name="address_province" required placeholder="Metro Manila" />
          </div>
        </div>

        {/* ── Emergency Contact ─────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <SectionLabel>Emergency Contact</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Name" name="emergency_contact_name" required placeholder="Juan Santos" />
            <Field
              label="Contact Phone"
              name="emergency_contact_phone"
              type="tel"
              required
              placeholder="09XX XXX XXXX"
              maxLength={11}
              pattern="09[0-9]{9}"
            />
          </div>
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
  )
}
