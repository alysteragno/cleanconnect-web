'use client'

type Branch = { id: string; name: string }

export function BranchFilter({
  branches,
  selected,
  baseHref,
}: {
  branches: Branch[]
  selected: string
  baseHref: string
}) {
  return (
    <select
      className="text-xs px-3 py-1.5 border border-gray-300 rounded-full bg-white text-gray-700 focus:outline-none"
      value={selected}
      onChange={(e) => {
        const params = new URLSearchParams(window.location.search)
        if (e.target.value) params.set('branch', e.target.value)
        else params.delete('branch')
        window.location.href = `${baseHref}${params.toString() ? '?' + params.toString() : ''}`
      }}
    >
      <option value="">All Branches</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  )
}
