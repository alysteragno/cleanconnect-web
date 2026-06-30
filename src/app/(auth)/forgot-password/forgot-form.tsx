'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { forgotPassword } from '@/app/actions/auth'
import { AuthField, AuthButton, AuthError, AuthFooter, authLinkClass } from '@/components/auth/auth-ui'

export default function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPassword, undefined)

  if (state?.success) {
    return (
      <div className="text-center space-y-4">
        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Check your email</p>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            If that address is registered, you&apos;ll receive a reset link shortly.
          </p>
        </div>
        <Link href="/login" className={`inline-block text-sm ${authLinkClass}`}>
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <AuthField
        id="email"
        name="email"
        label="Email address"
        type="email"
        required
        autoComplete="email"
        placeholder="name@example.com"
      />

      {state?.error && <AuthError>{state.error}</AuthError>}

      <AuthButton pending={pending} label="Send reset link" pendingLabel="Sending..." />

      <AuthFooter>
        <Link href="/login" className={authLinkClass}>Back to sign in</Link>
      </AuthFooter>
    </form>
  )
}
