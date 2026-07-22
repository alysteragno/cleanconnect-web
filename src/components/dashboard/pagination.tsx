'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { resolvePage } from '@/utils/pagination'

export function Pagination({
  totalItems,
  pageSize,
  paramName = 'page',
}: {
  totalItems: number
  pageSize: number
  paramName?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = resolvePage(searchParams.get(paramName) ?? undefined, totalItems, pageSize)

  function goTo(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (page <= 1) params.delete(paramName)
    else params.set(paramName, String(page))
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const pageSet = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1])
  const pageList = [...pageSet].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)

  const items: (number | 'ellipsis')[] = []
  let prev = 0
  for (const p of pageList) {
    if (prev && p - prev > 1) items.push('ellipsis')
    items.push(p)
    prev = p
  }

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 flex-wrap">
      <p className="text-xs text-gray-400">
        Page <span className="font-medium text-gray-600">{currentPage}</span> of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          ‹ Prev
        </button>
        {items.map((it, i) =>
          it === 'ellipsis' ? (
            <span key={`e${i}`} className="px-1.5 text-xs text-gray-300 select-none">…</span>
          ) : (
            <button
              key={it}
              type="button"
              onClick={() => goTo(it)}
              aria-current={it === currentPage ? 'page' : undefined}
              className={`min-w-[28px] px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                it === currentPage
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {it}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          Next ›
        </button>
      </div>
    </div>
  )
}
