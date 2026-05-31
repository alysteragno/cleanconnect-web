import Link from 'next/link'

export function PageHeader({
  back,
  backHref,
  title,
  subtitle,
  action,
}: {
  back?: string
  backHref?: string
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        {back && backHref && (
          <Link
            href={backHref}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors mb-1.5 inline-block"
          >
            &larr; {back}
          </Link>
        )}
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
