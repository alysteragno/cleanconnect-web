interface ServiceIconProps {
  name: string
  color?: string
  size?: number
}

export function ServiceIcon({ name, color = '#EC4899', size = 28 }: ServiceIconProps) {
  const s = {
    stroke: color,
    fill: 'none' as const,
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  const icons: Record<string, React.ReactNode> = {
    wind: (
      <>
        <path {...s} d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
        <path {...s} d="M9.6 4.6A2 2 0 1 1 11 8H2" />
        <path {...s} d="M12.6 19.4A2 2 0 1 0 14 16H2" />
      </>
    ),
    sofa: (
      <>
        <path {...s} d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3" />
        <path {...s} d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0Z" />
        <path {...s} d="M4 18v2" />
        <path {...s} d="M20 18v2" />
        <path {...s} d="M12 11v4" />
      </>
    ),
    scissors: (
      <>
        <circle {...s} cx="6" cy="6" r="3" />
        <path {...s} d="M8.12 8.12 12 12" />
        <path {...s} d="M20 4 8.12 15.88" />
        <circle {...s} cx="6" cy="18" r="3" />
        <path {...s} d="M14.8 14.8 20 20" />
      </>
    ),
    layers: (
      <>
        <path {...s} d="m12 2 10 5-10 5L2 7Z" />
        <path {...s} d="m2 17 10 5 10-5" />
        <path {...s} d="m2 12 10 5 10-5" />
      </>
    ),
    home: (
      <>
        <path {...s} d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path {...s} d="M9 22v-10h6v10" />
      </>
    ),
    building: (
      <>
        <path {...s} d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
        <path {...s} d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
        <path {...s} d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
        <path {...s} d="M10 6h4" />
        <path {...s} d="M10 10h4" />
        <path {...s} d="M10 14h4" />
        <path {...s} d="M10 18h4" />
      </>
    ),
    sparkles: (
      <>
        <path {...s} d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path {...s} d="M5 3v4" />
        <path {...s} d="M19 17v4" />
        <path {...s} d="M3 5h4" />
        <path {...s} d="M17 19h4" />
      </>
    ),
    droplets: (
      <>
        <path {...s} d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
        <path {...s} d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
      </>
    ),
    'hard-hat': (
      <>
        <path {...s} d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2Z" />
        <path {...s} d="M10 10V5a2 2 0 0 1 4 0v5" />
        <path {...s} d="M4 15v-3a8 8 0 0 1 16 0v3" />
      </>
    ),
    bed: (
      <>
        <path {...s} d="M2 4v16" />
        <path {...s} d="M2 8h18a2 2 0 0 1 2 2v10" />
        <path {...s} d="M2 17h20" />
        <path {...s} d="M6 8v9" />
      </>
    ),
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {icons[name] ?? (
        <path
          stroke={color}
          fill="none"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"
        />
      )}
    </svg>
  )
}
