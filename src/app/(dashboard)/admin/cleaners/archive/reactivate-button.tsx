'use client'

import { useActionState } from 'react'
import { toggleCleanerStatus } from '@/app/actions/admin'

// Compact inline counterpart to cleaners/[id]/cleaner-toggle-form.tsx — that
// one renders a full status card (label + description), which doesn't fit a
// dense archive list row, so this is just the button.
export default function ReactivateButton({ cleanerId }: { cleanerId: string }) {
  const [state, action, pending] = useActionState(toggleCleanerStatus, undefined)

  return (
    <form action={action}>
      <input type="hidden" name="cleaner_id" value={cleanerId} />
      <input type="hidden" name="is_active" value="false" />
      <button
        type="submit"
        disabled={pending}
        className="w-full text-sm px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 bg-green-50 text-green-600 hover:bg-green-100 border border-green-200"
      >
        {pending ? '...' : 'Reactivate'}
      </button>
      {state?.error && (
        <p className="mt-1 text-[11px] text-red-600">{state.error}</p>
      )}
    </form>
  )
}
