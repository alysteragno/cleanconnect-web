export default function SectionHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="text-center mb-12">
      <h2 className="text-3xl font-bold text-gray-900 mb-3">{title}</h2>
      {subtitle && <p className="text-gray-500">{subtitle}</p>}
    </div>
  )
}
