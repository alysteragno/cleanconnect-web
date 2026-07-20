'use client'

import { useEffect, useRef, useState } from 'react'

type Option = { value: string; label: string }

export function SelectDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const active = options.find((o) => o.value === value)

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

  function select(v: string) {
    closeDropdown()
    if (v !== value) onChange(v)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? closeDropdown() : setOpen(true))}
        className={`w-full flex items-center justify-between gap-2 pl-3 pr-3 py-2.5 text-sm font-medium text-left
                   border rounded-xl bg-gray-50 transition-colors active:scale-[0.99]
                   disabled:opacity-40 disabled:cursor-not-allowed
                   ${open
                     ? 'border-pink-300 ring-2 ring-pink-500/20 text-gray-900'
                     : 'border-gray-200 text-gray-800 hover:border-gray-300'}`}
      >
        <span className="truncate">{active?.label ?? placeholder}</span>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {(open || closing) && (
        <div
          style={{ transformOrigin: 'top center' }}
          className={`absolute left-0 top-full mt-1.5 z-50 w-full min-w-[160px] bg-white border border-gray-200
                     rounded-xl shadow-lg shadow-gray-200/60 py-1.5 max-h-64 overflow-y-auto
                     ${closing ? 'animate-dropdown-out' : 'animate-dropdown-in'}`}
          onAnimationEnd={() => { if (closing) { setClosing(false); setOpen(false) } }}
        >
          {options.map((o) => {
            const isActive = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => select(o.value)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                  isActive ? 'text-pink-700 bg-pink-50 font-semibold' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
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
