'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Debounced, URL-driven name search. Writes to `paramName` (default `q`)
 * after the user stops typing, and drops `resetParams` (pagination cursors)
 * since a new query changes which page is meaningful.
 */
export function SearchBox({
  placeholder = 'Search by name…',
  paramName = 'q',
  resetParams = ['page'],
}: {
  placeholder?: string
  paramName?: string
  resetParams?: string[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlValue = searchParams.get(paramName) ?? ''
  const [value, setValue] = useState(urlValue)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Stay in sync when the param changes from outside this input (back/forward
  // nav, cleared elsewhere) — reset during render rather than in an effect,
  // per https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [prevUrlValue, setPrevUrlValue] = useState(urlValue)
  if (urlValue !== prevUrlValue) {
    setPrevUrlValue(urlValue)
    setValue(urlValue)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  function commit(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    const trimmed = next.trim()
    if (trimmed) params.set(paramName, trimmed)
    else params.delete(paramName)
    for (const p of resetParams) params.delete(p)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  function handleChange(next: string) {
    setValue(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => commit(next), 350)
  }

  function handleClear() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setValue('')
    commit('')
  }

  return (
    <div className="relative w-full sm:w-60">
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-7 py-2 text-xs border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-300 transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
