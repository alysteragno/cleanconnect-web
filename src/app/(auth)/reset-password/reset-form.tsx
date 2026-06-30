'use client'

import { useActionState } from 'react'
import { resetPassword } from '@/app/actions/auth'
import { AuthField, AuthButton, AuthError } from '@/components/auth/auth-ui'

export default function ResetForm() {
  const [state, action, pending] = useActionState(resetPassword, undefined)

  return (
    <form action={action} className="space-y-4">
      <AuthField
        id="password"
        name="password"
        label="New password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="••••••••"
        hint="Minimum 8 characters"
      />

      <AuthField
        id="confirm"
        name="confirm"
        label="Confirm new password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="••••••••"
      />

      {state?.error && <AuthError>{state.error}</AuthError>}

      <AuthButton pending={pending} label="Update password" pendingLabel="Updating..." />
    </form>
  )
}
