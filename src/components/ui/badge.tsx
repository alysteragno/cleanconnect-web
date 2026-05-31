type BadgeVariant = 'default' | 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'offered' | 'accepted' | 'declined' | 'paid' | 'unpaid' | 'partial' | 'refunded' | 'open' | 'resolved' | 'active' | 'inactive'

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default:     'bg-gray-100 text-gray-600 border-gray-200',
  pending:     'bg-amber-50 text-amber-700 border-amber-200',
  confirmed:   'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-violet-50 text-violet-700 border-violet-200',
  completed:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled:   'bg-red-50 text-red-600 border-red-200',
  offered:     'bg-amber-50 text-amber-700 border-amber-200',
  accepted:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined:    'bg-red-50 text-red-600 border-red-200',
  paid:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  unpaid:      'bg-red-50 text-red-600 border-red-200',
  partial:     'bg-amber-50 text-amber-700 border-amber-200',
  refunded:    'bg-gray-100 text-gray-600 border-gray-200',
  open:        'bg-amber-50 text-amber-700 border-amber-200',
  resolved:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  active:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive:    'bg-gray-100 text-gray-500 border-gray-200',
}

export function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode
  variant?: BadgeVariant
}) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${VARIANT_STYLES[variant]}`}>
      {children}
    </span>
  )
}

export function statusVariant(status: string): BadgeVariant {
  return (VARIANT_STYLES[status as BadgeVariant] ? status : 'default') as BadgeVariant
}
