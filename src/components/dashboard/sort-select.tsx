'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Option = { value: string; label: string }

export function SortSelect({ options, paramName = 'sort' }: { options: Option[]; paramName?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get(paramName) ?? options[0]?.value ?? ''
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const activeLabel = options.find(o => o.value === current)?.label ?? options[0]?.label

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function select(value: string) {
    setOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    if (value === options[0]?.value) {
      params.delete(paramName)
    } else {
      params.set(paramName, value)
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-2 transition-all ${
          open
            ? 'border-pink-300 bg-pink-50 text-pink-700 ring-2 ring-pink-500/20'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-50">
          <path d="M3 6h18M6 12h12M9 18h6" />
        </svg>
        {activeLabel}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 opacity-40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[200px] bg-white border border-gray-200 rounded-xl shadow-lg shadow-gray-200/60 py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Sort by</p>
          {options.map((o) => {
            const isActive = o.value === current
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
