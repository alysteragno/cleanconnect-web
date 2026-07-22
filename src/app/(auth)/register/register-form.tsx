'use client'

import { useActionState, useState } from 'react'
import { register } from '@/app/actions/auth'
import { AuthField, AuthButton, AuthError } from '@/components/auth/auth-ui'

// PH mobile numbers are digits only — pattern="09[0-9]{9}" only catches this
// at submit time, and type="tel" doesn't block keystrokes on its own.
function sanitizePhoneInput(value: string) {
  return value.replace(/[^0-9]/g, '')
}

const PASSWORD_REQUIREMENTS = [
  { label: 'Minimum 8 characters',          test: (p: string) => p.length >= 8 },
  { label: 'At least one uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'At least one lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'At least one number',           test: (p: string) => /[0-9]/.test(p) },
  { label: 'At least one special character',test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

export default function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const typed = password.length > 0

  const fe = state?.fieldErrors

  return (
    <form action={action} className="space-y-4">
      <AuthField
        id="name"
        name="name"
        label="Full name"
        type="text"
        required
        maxLength={100}
        autoComplete="name"
        placeholder="Juan dela Cruz"
        defaultValue={state?.fields?.name}
        error={fe?.name}
      />

      <AuthField
        id="email"
        name="email"
        label="Email address"
        type="email"
        required
        autoComplete="email"
        placeholder="example@gmail.com"
        defaultValue={state?.fields?.email}
        error={fe?.email}
      />

      <AuthField
        id="phone"
        name="phone"
        label="Phone number"
        type="tel"
        required
        maxLength={11}
        pattern="09[0-9]{9}"
        autoComplete="tel"
        placeholder="09XX XXX XXXX"
        defaultValue={state?.fields?.phone}
        error={fe?.phone}
        onChange={(e) => { e.target.value = sanitizePhoneInput(e.target.value) }}
      />

      <div>
        <div className="relative">
          <AuthField
            id="password"
            name="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder="Create a strong password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            error={fe?.password}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-[2.1rem] text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>

        <ul className="mt-2 space-y-1">
          {PASSWORD_REQUIREMENTS.map(req => {
            const met = typed && req.test(password)
            return (
              <li
                key={req.label}
                className={`flex items-center gap-2 text-xs transition-colors ${
                  met ? 'text-emerald-600' : 'text-gray-400'
                }`}
              >
                <span className="w-3 text-center font-bold">{met ? '✓' : '○'}</span>
                {req.label}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="relative">
        <AuthField
          id="confirm_password"
          name="confirm_password"
          label="Confirm password"
          type={showConfirm ? 'text' : 'password'}
          required
          autoComplete="new-password"
          placeholder="Re-enter your password"
          error={fe?.confirm_password}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowConfirm(v => !v)}
          className="absolute right-3 top-[2.1rem] text-gray-400 hover:text-gray-600 transition-colors"
          aria-label={showConfirm ? 'Hide password' : 'Show password'}
        >
          {showConfirm ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          )}
        </button>
      </div>

      {state?.error && <AuthError>{state.error}</AuthError>}

      <AuthButton pending={pending} label="Create account" pendingLabel="Creating account..." />
    </form>
  )
}
