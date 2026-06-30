'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'
import { AuthField, AuthButton, AuthError, AuthFooter, authLinkClass } from '@/components/auth/auth-ui'

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <form action={action} className="space-y-4 mb-[7rem]">
      <AuthField
        id="email"
        name="email"
        label="Email address"
        type="email"
        required
        autoComplete="email"
        placeholder="name@example.com"
      />

      <AuthField
        id="password"
        name="password"
        label="Password"
        type="password"
        required
        autoComplete="current-password"
        placeholder="••••••••"
        aside={
          <a href="/forgot-password" className={`text-xs ${authLinkClass}`}>
            Forgot password?
          </a>
        }
      />

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

      <AuthFooter>
        Don&apos;t have an account?{' '}
        <a href="/register" className={authLinkClass}>Register</a>
      </AuthFooter>
    </form>
  )
}
