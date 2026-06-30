import type { InputHTMLAttributes, ReactNode } from 'react'

export const inputClass =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition'

// ─── Field ───────────────────────────────────────────────────────────────────

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  name: string
  label: string
  hint?: string
  aside?: ReactNode
}

export function AuthField({ id, name, label, hint, aside, ...inputProps }: AuthFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        {aside}
      </div>
      <input id={id} name={name} className={inputClass} {...inputProps} />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

// ─── Submit button ────────────────────────────────────────────────────────────

export function AuthButton({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean
  label: string
  pendingLabel: string
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2.5 px-4 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? pendingLabel : label}
    </button>
  )
}

// ─── Error banner ─────────────────────────────────────────────────────────────

export function AuthError({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 space-y-0.5">
      {children}
    </div>
  )
}

// ─── Success banner ───────────────────────────────────────────────────────────

export function AuthSuccess({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
      {children}
    </div>
  )
}

// ─── Footer link row ──────────────────────────────────────────────────────────

export function AuthFooter({ children }: { children: ReactNode }) {
  return (
    <p className="text-center text-sm text-gray-500 mt-6">
      {children}
    </p>
  )
}

export const authLinkClass = 'text-pink-600 font-medium hover:text-pink-700 transition-colors'
