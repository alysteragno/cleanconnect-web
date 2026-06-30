'use client'

import { useActionState, useState } from 'react'
import { register } from '@/app/actions/auth'
import { AuthField, AuthButton, AuthError, AuthFooter, authLinkClass } from '@/components/auth/auth-ui'

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
  const typed = password.length > 0

  return (
    <form action={action} className="space-y-4">
      <AuthField
        id="name"
        name="name"
        label="Full name"
        type="text"
        required
        autoComplete="name"
        placeholder="Juan dela Cruz"
      />

      <AuthField
        id="email"
        name="email"
        label="Email address"
        type="email"
        required
        autoComplete="email"
        placeholder="example@gmail.com"
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
      />

      <div>
        <AuthField
          id="password"
          name="password"
          label="Password"
          type="password"
          required
          autoComplete="new-password"
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

      <AuthField
        id="confirm_password"
        name="confirm_password"
        label="Confirm password"
        type="password"
        required
        autoComplete="new-password"
        placeholder="Re-enter your password"
      />

      {state?.error && <AuthError>{state.error}</AuthError>}

      <AuthButton pending={pending} label="Create account" pendingLabel="Creating account..." />

      
    </form>
  )
}
