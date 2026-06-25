'use client'

import { useEffect, useRef, useState } from 'react'

type Tone = 'neutral' | 'amber' | 'violet' | 'emerald' | 'blue' | 'red'

const TONE: Record<Tone, { accent: string; icon: string; text: string }> = {
  neutral: { accent: 'border-l-gray-300',   icon: 'bg-gray-100 text-gray-600',     text: 'text-gray-900' },
  amber:   { accent: 'border-l-amber-400',  icon: 'bg-amber-50 text-amber-600',    text: 'text-amber-600' },
  violet:  { accent: 'border-l-violet-400', icon: 'bg-violet-50 text-violet-600',  text: 'text-violet-600' },
  emerald: { accent: 'border-l-emerald-400',icon: 'bg-emerald-50 text-emerald-600',text: 'text-emerald-600' },
  blue:    { accent: 'border-l-pink-400',   icon: 'bg-pink-50 text-pink-600',      text: 'text-pink-600' },
  red:     { accent: 'border-l-red-400',    icon: 'bg-red-50 text-red-600',        text: 'text-red-600' },
}

function CountUp({ target }: { target: number }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const duration = 700
    const start = performance.now()
    function step(now: number) {
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(ease * target))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target])

  return <>{display}</>
}

export function StatCard({
  label,
  value,
  tone = 'neutral',
  sub,
  icon,
}: {
  label: string
  value: string | number
  tone?: Tone
  sub?: string
  icon?: React.ReactNode
}) {
  const t = TONE[tone]
  const isNumber = typeof value === 'number'

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${t.accent} px-4 py-4 flex items-start gap-3 shadow-sm hover:shadow-md transition-all duration-200 cursor-default`}>
      {icon && (
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${t.icon}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className={`text-2xl font-bold tracking-tight tabular-nums leading-none ${t.text}`}>
          {isNumber ? <CountUp target={value} /> : value}
        </p>
        <p className="text-xs text-gray-500 mt-1.5 font-medium leading-tight">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
