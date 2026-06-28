'use client'

import { useRef } from 'react'

type Announcement = { id: string; title: string; body: string | null; created_at: string }

const MegaphoneIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-pink-600 shrink-0 mt-0.5"
  >
    <path d="M2 6v4h2.5L10 13V3L4.5 6H2z" />
    <path d="M12 5.5a3 3 0 010 5" />
  </svg>
)

export default function AnnouncementCarousel({ items }: { items: Announcement[] }) {
  const ref = useRef<HTMLDivElement>(null)

  if (items.length === 0) return null

  const scroll = (dir: 'left' | 'right') => {
    if (!ref.current) return
    ref.current.scrollBy({ left: dir === 'left' ? -304 : 304, behavior: 'smooth' })
  }

  return (
    <section className="bg-white py-8 sm:py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Label row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MegaphoneIcon />
            <span className="text-sm font-semibold text-gray-700">Announcements</span>
          </div>

          {items.length > 1 && (
            <div className="flex gap-1">
              <button
                onClick={() => scroll('left')}
                aria-label="Scroll left"
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-pink-300 hover:text-pink-600 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7.5 2.5L4 6l3.5 3.5" />
                </svg>
              </button>
              <button
                onClick={() => scroll('right')}
                aria-label="Scroll right"
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-pink-300 hover:text-pink-600 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 2.5L8 6l-3.5 3.5" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Horizontal scroll track */}
        <div
          ref={ref}
          className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((a) => (
            <div
              key={a.id}
              className="snap-start shrink-0 w-72 sm:w-80 flex items-start gap-3 bg-pink-50 border border-pink-200 rounded-xl px-5 py-4"
            >
              <MegaphoneIcon />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-pink-900 leading-snug">{a.title}</p>
                {a.body && (
                  <p className="text-xs text-pink-700 mt-0.5 leading-relaxed line-clamp-3">{a.body}</p>
                )}
                <p className="text-xs text-pink-400 mt-1.5">
                  {new Date(a.created_at).toLocaleDateString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  ·{' '}
                  {new Date(a.created_at).toLocaleTimeString('en-PH', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
