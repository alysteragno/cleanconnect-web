type IconProps = { className?: string }

const base = 'stroke-current fill-none'
const props = { width: 16, height: 16, viewBox: '0 0 16 16', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export function IconDashboard({ className }: IconProps) {
  return (
    <svg {...props} className={`${base} ${className ?? ''}`}>
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    </svg>
  )
}

export function IconCalendar({ className }: IconProps) {
  return (
    <svg {...props} className={`${base} ${className ?? ''}`}>
      <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" />
      <path d="M5 1.5v3M11 1.5v3M1.5 7h13" />
    </svg>
  )
}

export function IconUsers({ className }: IconProps) {
  return (
    <svg {...props} className={`${base} ${className ?? ''}`}>
      <circle cx="8" cy="5" r="2.5" />
      <path d="M2.5 14c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" />
    </svg>
  )
}

export function IconBuilding({ className }: IconProps) {
  return (
    <svg {...props} className={`${base} ${className ?? ''}`}>
      <path d="M2 14.5V6.5L8 2l6 4.5v8H2z" />
      <rect x="6" y="9.5" width="4" height="5" rx="0.5" />
    </svg>
  )
}

export function IconStar({ className }: IconProps) {
  return (
    <svg {...props} className={`${base} ${className ?? ''}`}>
      <path d="M8 1.5l1.854 3.757 4.146.603-3 2.927.708 4.13L8 10.771l-3.708 1.946.708-4.13-3-2.927 4.146-.603L8 1.5z" />
    </svg>
  )
}

export function IconChat({ className }: IconProps) {
  return (
    <svg {...props} className={`${base} ${className ?? ''}`}>
      <path d="M14 9.5a2 2 0 01-2 2H5l-2.5 2.5V4a2 2 0 012-2h7.5A2 2 0 0114 4v5.5z" />
    </svg>
  )
}

export function IconChart({ className }: IconProps) {
  return (
    <svg {...props} className={`${base} ${className ?? ''}`}>
      <path d="M2 13.5h2.5V8H2v5.5zM6.75 13.5h2.5V4h-2.5v9.5zM11.5 13.5H14V6.5h-2.5v7z" />
    </svg>
  )
}

export function IconSettings({ className }: IconProps) {
  return (
    <svg {...props} className={`${base} ${className ?? ''}`}>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v1.75M8 12.75v1.75M1.5 8h1.75M12.75 8h1.75M3.287 3.287l1.237 1.237M11.476 11.476l1.237 1.237M12.713 3.287l-1.237 1.237M4.524 11.476l-1.237 1.237" />
    </svg>
  )
}

export function IconSignOut({ className }: IconProps) {
  return (
    <svg {...props} className={`${base} ${className ?? ''}`}>
      <path d="M6 13.5H3a1 1 0 01-1-1V3.5a1 1 0 011-1h3M10.5 11l3.5-3.5L10.5 4M14 7.5H6" />
    </svg>
  )
}

export function IconBell({ className }: IconProps) {
  return (
    <svg {...props} className={`${base} ${className ?? ''}`}>
      <path d="M8 1.5A4.5 4.5 0 003.5 6v3l-1.5 2.5h12L12.5 9V6A4.5 4.5 0 008 1.5zM6.5 12.5a1.5 1.5 0 003 0" />
    </svg>
  )
}

export function IconCreditCard({ className }: IconProps) {
  return (
    <svg {...props} className={`${base} ${className ?? ''}`}>
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M1.5 7h13M4 10.5h2M10 10.5h2" />
    </svg>
  )
}

export function IconChevronRight({ className }: IconProps) {
  return (
    <svg {...props} className={`${base} ${className ?? ''}`}>
      <path d="M6 3l5 5-5 5" />
    </svg>
  )
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg {...props} className={`${base} ${className ?? ''}`}>
      <path d="M2.5 8.5l3.5 3.5 7-7" />
    </svg>
  )
}

export function IconX({ className }: IconProps) {
  return (
    <svg {...props} className={`${base} ${className ?? ''}`}>
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  )
}
