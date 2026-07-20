'use client'

import { useActionState, useEffect, useState } from 'react'
import { login } from '@/app/actions/auth'
import { AuthField, AuthButton, AuthError, AuthSuccess, AuthFooter, authLinkClass } from '@/components/auth/auth-ui'

// The mobile app confirms new signups through Supabase's classic implicit
// flow: after confirming server-side, Supabase redirects here with
// `#access_token=...&type=signup` in the URL hash, which a server component
// can never see. We only need to notice it to show a confirmation banner —
// no session is established and the user still logs in normally below.
function useSignupConfirmedFromHash() {
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    if (!hash) return

    const params = new URLSearchParams(hash)
    if (params.get('type') === 'signup') {
      setConfirmed(true)
    }

    if (params.has('type') || params.has('access_token')) {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  return confirmed
}

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)
  const [showPassword, setShowPassword] = useState(false)
  const signupConfirmed = useSignupConfirmedFromHash()

  const fe = state?.fieldErrors

  return (
    <form action={action} className="space-y-4 mb-[7rem]">
      {signupConfirmed && (
        <AuthSuccess>Email confirmed! You can now log in below.</AuthSuccess>
      )}

      <AuthField
        id="email"
        name="email"
        label="Email address"
        type="email"
        required
        autoComplete="email"
        placeholder="name@example.com"
        defaultValue={state?.fields?.email}
        error={fe?.email}
      />

      <div className="relative">
        <AuthField
          id="password"
          name="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          required
          autoComplete="current-password"
          placeholder="••••••••"
          error={fe?.password}
          aside={
            <a href="/forgot-password" className={`text-xs ${authLinkClass}`}>
              Forgot password?
            </a>
          }
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

      {state?.error && (
        <AuthError>
          <p>{state.error}</p>
          {state.remainingAttempts !== undefined && (
            <p className="font-medium">
              {state.remainingAttempts === 0
                ? 'This was your last attempt.'
                : `${state.remainingAttempts} attempt${state.remainingAttempts !== 1 ? 's' : ''} remaining before lockout.`}
            </p>
          )}
        </AuthError>
      )}

      <AuthButton pending={pending} label="Sign in" pendingLabel="Signing in..." />


    </form>
  )
}
