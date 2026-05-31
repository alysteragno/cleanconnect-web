type Tone = 'neutral' | 'amber' | 'violet' | 'emerald' | 'blue' | 'red'

const TONE_STYLES: Record<Tone, { value: string; bg: string }> = {
  neutral:  { value: 'text-gray-900',   bg: 'bg-white' },
  amber:    { value: 'text-amber-600',  bg: 'bg-white' },
  violet:   { value: 'text-violet-600', bg: 'bg-white' },
  emerald:  { value: 'text-emerald-600',bg: 'bg-white' },
  blue:     { value: 'text-blue-600',   bg: 'bg-white' },
  red:      { value: 'text-red-600',    bg: 'bg-white' },
}

export function StatCard({
  label,
  value,
  tone = 'neutral',
  sub,
}: {
  label: string
  value: string | number
  tone?: Tone
  sub?: string
}) {
  const { value: valueClass, bg } = TONE_STYLES[tone]
  return (
    <div className={`${bg} rounded-xl border border-gray-200 px-5 py-4`}>
      <p className={`text-2xl font-bold tracking-tight ${valueClass}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
