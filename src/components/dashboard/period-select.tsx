'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Option = { value: string; label: string }

/**
 * URL-driven dropdown for the bounded date-range presets (Past 3 Days …
 * Next Month). Kept separate from `options` are period values like
 * "All Time" / "Custom Range" that have their own dedicated controls —
 * `activeValue` still needs to reflect those so the trigger falls back to a
 * neutral label instead of falsely highlighting one of the dropdown's own
 * options.
 */
export function PeriodSelect({
  options,
  activeValue,
  defaultValue,
  paramName = 'period',
}: {
  options: readonly Option[]
  activeValue: string
  defaultValue: string
  paramName?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const [closing, setClosing] = useState(false)
  const activeOption = options.find((o) => o.value === activeValue)

  function closeDropdown() {
    setClosing(true)
  }

  useEffect(() => {
    if (!open && !closing) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) closeDropdown()
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open, closing])

  function select(value: string) {
    closeDropdown()
    const params = new URLSearchParams(searchParams.toString())
    if (value === defaultValue) {
      params.delete(paramName)
    } else {
      params.set(paramName, value)
    }
    // Bounded presets don't take a custom range — drop any leftover one.
    params.delete('start')
    params.delete('end')
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (open ? closeDropdown() : setOpen(true))}
        className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-2 active:scale-95 transition-all ${
          open
            ? 'border-pink-300 bg-pink-50 text-pink-700 ring-2 ring-pink-500/20'
            : activeOption
              ? 'border-pink-200 bg-pink-50/60 text-pink-700'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-50">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        {activeOption?.label ?? 'Period'}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 opacity-40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {(open || closing) && (
        <div
          className={`absolute left-0 top-full mt-1.5 z-50 min-w-[180px] bg-white border border-gray-200 rounded-xl shadow-lg shadow-gray-200/60 py-1.5 ${closing ? 'animate-dropdown-out' : 'animate-dropdown-in'}`}
          onAnimationEnd={() => { if (closing) { setClosing(false); setOpen(false) } }}
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Period</p>
          {options.map((o) => {
            const isActive = o.value === activeValue
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => select(o.value)}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
                  isActive
                    ? 'text-pink-700 bg-pink-50 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${isActive ? 'bg-pink-500' : 'bg-transparent'}`} />
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
