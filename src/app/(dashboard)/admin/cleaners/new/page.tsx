'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { createCleanerAccount } from '@/app/actions/admin'
import CleanerPhotoField from '../cleaner-photo-field'
import { useBasePath } from '@/components/dashboard/base-path-context'

// Same character rules as the manual-booking form (src/lib/booking-constants
// doesn't cover these — they're name/address text, not booking option
// whitelists) — strips <, @, %, and other markup/injection characters as typed.
// Mirrors NAME_TEXT_RE / ADDRESS_TEXT_RE in src/app/actions/admin.ts.
const NAME_UNSAFE_CHARS_RE = /[^a-zA-ZÀ-ÿ' .-]/g
function sanitizeNameInput(value: string) {
  return value.replace(NAME_UNSAFE_CHARS_RE, '')
}
const ADDRESS_UNSAFE_CHARS_RE = /[^a-zA-Z0-9À-ÿ.,'#\-/() ]/g
function sanitizeAddressInput(value: string) {
  return value.replace(ADDRESS_UNSAFE_CHARS_RE, '')
}
// Mirrors EMAIL_RE's charset in src/app/actions/admin.ts — only letters,
// digits, and . _ - + @ are allowed, so <, >, spaces, and anything else
// (e.g. "<><?><?><") never make it into the field at all as typed.
const EMAIL_UNSAFE_CHARS_RE = /[^a-zA-Z0-9._+@-]/g
function sanitizeEmailInput(value: string) {
  return value.replace(EMAIL_UNSAFE_CHARS_RE, '')
}
// PH mobile numbers are digits only — pattern="09[0-9]{9}" only catches this
// at submit time, and type="tel" doesn't block keystrokes on its own, so
// strip anything non-numeric as typed too.
const PHONE_UNSAFE_CHARS_RE = /[^0-9]/g
function sanitizePhoneInput(value: string) {
  return value.replace(PHONE_UNSAFE_CHARS_RE, '')
}

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
  autoComplete,
  sanitize,
  error,
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
  autoComplete?: string
  /** Strips disallowed characters as the user types (imperative — works even on uncontrolled inputs). */
  sanitize?: (value: string) => string
  /** Server-side validation message for this exact field — shown inline under the input. */
  error?: string
}) {
  const [revealed, setRevealed] = useState(false)
  const isPassword = revealable && type === 'password'
  const effectiveType = isPassword ? (revealed ? 'text' : 'password') : type

  const fieldId = `field-${name}`

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        {!required && <span className="text-gray-400 font-normal ml-1">(optional)</span>}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          name={name}
          type={effectiveType}
          required={required}
          placeholder={placeholder}
          minLength={min}
          max={max}
          maxLength={maxLength}
          pattern={pattern}
          value={value}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          onChange={(e) => {
            if (sanitize) e.target.value = sanitize(e.target.value)
            onChange?.(e)
          }}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${isPassword ? 'pr-10' : ''} ${
            error
              ? 'border-red-300 focus:ring-red-400 bg-red-50/40'
              : 'border-gray-300 focus:ring-pink-500'
          }`}
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
      {error ? (
        <p id={`${fieldId}-error`} className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-gray-400 mt-1">{hint}</p>
      ) : null}
    </div>
  )
}

type FormValues = {
  email: string
  confirm_password: string
  full_name: string
  phone: string
  date_of_birth: string
  address_street: string
  address_city: string
  address_province: string
  emergency_contact_name: string
  emergency_contact_phone: string
}

const EMPTY_VALUES: FormValues = {
  email: '', confirm_password: '', full_name: '', phone: '', date_of_birth: '',
  address_street: '', address_city: '', address_province: '',
  emergency_contact_name: '', emergency_contact_phone: '',
}

export default function NewCleanerPage() {
  const [state, action, pending] = useActionState(createCleanerAccount, undefined)
  const basePath = useBasePath()
  const [password, setPassword] = useState('')
  const typed = password.length > 0
  const formRef = useRef<HTMLFormElement>(null)
  const fieldErrors = state?.fieldErrors ?? {}

  // React resets every uncontrolled field in a <form action={...}> once the
  // action call completes — including on a failed submit, not just a
  // successful one. Without this, a typo in one field would wipe every
  // other field the admin already filled in. Controlling them from state
  // sidesteps that reset entirely (React re-renders from `values` right
  // after, overriding whatever the reset just did).
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES)
  function setField(name: keyof FormValues) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues(v => ({ ...v, [name]: e.target.value }))
    }
  }

  // Jump straight to the first invalid field instead of leaving the admin to
  // hunt through four sections for whichever one the server rejected.
  useEffect(() => {
    if (!state?.fieldErrors) return
    const firstBadField = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    firstBadField?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    firstBadField?.focus()
  }, [state])

  // Latest date of birth that still makes the cleaner 18 today.
  const maxDob = (() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 18)
    return d.toISOString().slice(0, 10)
  })()

  // Account creation no longer redirects straight to Cleaners on success —
  // this confirmation state exists so the admin can read back the password
  // reminder and email before navigating away.
  if (state?.success) {
    return (
      <div className="max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">Cleaner account created</p>
            <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{state.success}</p>
          </div>
          <div className="flex items-center justify-center gap-2.5 pt-1">
            <Link
              href={`${basePath}/cleaners/new`}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:border-gray-400 hover:text-gray-900 transition-colors"
            >
              Add Another
            </Link>
            <Link
              href={`${basePath}/cleaners`}
              className="px-4 py-2 bg-pink-600 text-white text-sm font-semibold rounded-lg hover:bg-pink-700 transition-colors"
            >
              Go to Cleaners
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`${basePath}/cleaners`} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Cleaners
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Add Cleaner</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Creates a login account and employment profile for the new cleaner.
          All fields are required for compliance with PH labour requirements.
        </p>
      </div>

      {/*
        noValidate — the inputs below keep `required`/`type="email"`/`pattern`
        etc. for semantics and mobile keyboard hints, but native HTML5
        validation would otherwise intercept submit before our action ever
        runs: it blocks on the FIRST invalid field it finds, shows only its
        own native tooltip for that one field, and never calls the server —
        so fieldErrors never gets populated and nothing else gets checked.
        Disabling it hands 100% of validation to our sanitize-as-you-type +
        server fieldErrors + inline-error-per-field system instead.
      */}
      <form ref={formRef} action={action} className="space-y-5" autoComplete="off" noValidate>
        {/* ── Account Credentials ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <SectionLabel>Account Credentials</SectionLabel>
          {/*
            autoComplete is set on every field below to stop the browser from
            offering to autofill the ADMIN's own saved login into what is
            actually a brand-new cleaner account — "off" on the email/name
            fields, and "new-password" (the standard signal for "this creates
            a password, don't suggest a saved one") on both password fields.
          */}
          <Field
            label="Email" name="email" type="email" required placeholder="maria@gmail.com"
            autoComplete="off" sanitize={sanitizeEmailInput} maxLength={254}
            value={values.email} onChange={setField('email')}
            error={fieldErrors.email}
          />

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
              autoComplete="new-password"
              error={fieldErrors.password}
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
            autoComplete="new-password"
            value={values.confirm_password} onChange={setField('confirm_password')}
            error={fieldErrors.confirm_password}
          />
        </div>

        {/* ── Personal Information ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <SectionLabel>Personal Information</SectionLabel>
          <CleanerPhotoField required serverError={fieldErrors.photo} />
          <Field
            label="Full Name" name="full_name" required placeholder="Maria Santos" autoComplete="off"
            sanitize={sanitizeNameInput} maxLength={100}
            value={values.full_name} onChange={setField('full_name')}
            error={fieldErrors.full_name}
          />
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
              autoComplete="off"
              sanitize={sanitizePhoneInput}
              value={values.phone} onChange={setField('phone')}
              error={fieldErrors.phone}
            />
            <Field
              label="Date of Birth"
              name="date_of_birth"
              type="date"
              required
              max={maxDob}
              hint="Cleaner must be at least 18 years old"
              autoComplete="off"
              value={values.date_of_birth} onChange={setField('date_of_birth')}
              error={fieldErrors.date_of_birth}
            />
          </div>
        </div>

        {/* ── Home Address ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <SectionLabel>Address</SectionLabel>
          <Field
            label="Street Address" name="address_street" required placeholder="123 Sampaguita St., Brgy. Malaya"
            autoComplete="off" sanitize={sanitizeAddressInput} maxLength={200}
            value={values.address_street} onChange={setField('address_street')}
            error={fieldErrors.address_street}
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="City / Municipality" name="address_city" required placeholder="Quezon City" autoComplete="off"
              sanitize={sanitizeAddressInput} maxLength={100}
              value={values.address_city} onChange={setField('address_city')}
              error={fieldErrors.address_city}
            />
            <Field
              label="Province" name="address_province" required placeholder="Metro Manila" autoComplete="off"
              sanitize={sanitizeAddressInput} maxLength={100}
              value={values.address_province} onChange={setField('address_province')}
              error={fieldErrors.address_province}
            />
          </div>
        </div>

        {/* ── Emergency Contact ─────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <SectionLabel>Emergency Contact</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Contact Name" name="emergency_contact_name" required placeholder="Juan Santos" autoComplete="off"
              sanitize={sanitizeNameInput} maxLength={100}
              value={values.emergency_contact_name} onChange={setField('emergency_contact_name')}
              error={fieldErrors.emergency_contact_name}
            />
            <Field
              label="Contact Phone"
              name="emergency_contact_phone"
              type="tel"
              required
              placeholder="09XX XXX XXXX"
              maxLength={11}
              pattern="09[0-9]{9}"
              sanitize={sanitizePhoneInput}
              value={values.emergency_contact_phone} onChange={setField('emergency_contact_phone')}
              error={fieldErrors.emergency_contact_phone}
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
