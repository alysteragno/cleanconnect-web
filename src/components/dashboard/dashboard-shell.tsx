'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface Props {
  sidebarContent: React.ReactNode
  topBarContent: React.ReactNode
  children: React.ReactNode
}

const PATH_LABELS: Record<string, string> = {
  admin:         'Dashboard',
  bookings:      'Bookings',
  cleaners:      'Cleaners',
  customers:     'Customers',
  complaints:    'Complaints',
  feedback:      'Feedback',
  announcements: 'Announcements',
  reports:       'Reports',
  settings:      'Bank Check Settings',
  customer:      'Dashboard',
  cleaner:       'Dashboard',
  manager:       'Dashboard',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function Breadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  const crumbs = segments.map((seg) => {
    if (UUID_RE.test(seg)) return 'Detail'
    return PATH_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1)
  })

  // Collapse: for /admin/bookings/detail → ['Dashboard', 'Bookings', 'Detail']
  // But only show last two to keep it compact
  const visible = crumbs.length > 2 ? crumbs.slice(-2) : crumbs

  return (
    <nav className="hidden md:flex items-center gap-1.5 text-sm text-gray-400">
      {visible.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-gray-300">/</span>}
          <span className={i === visible.length - 1 ? 'text-gray-700 font-medium' : 'text-gray-400'}>
            {crumb}
          </span>
        </span>
      ))}
    </nav>
  )
}

export function DashboardShell({ sidebarContent, topBarContent, children }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Mobile backdrop — z-40 covers header (z-10) and notification dropdown (z-30) */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar — z-50 sits above backdrop and everything else */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-56 bg-pink-700 flex flex-col transition-all duration-300 ease-out ${
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Mobile close button */}
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-3 p-1.5 rounded-lg text-pink-200 hover:bg-pink-600 hover:text-white transition-colors md:hidden"
          aria-label="Close sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M4 4l12 12M16 4L4 16"/>
          </svg>
        </button>
        {sidebarContent}
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-56">

        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-100 px-4 md:px-6 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center justify-center w-9 h-9 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors md:hidden shrink-0"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? (
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="pointer-events-none">
                <path d="M4 4l12 12M16 4L4 16"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="pointer-events-none">
                <path d="M3 5h14M3 10h14M3 15h14"/>
              </svg>
            )}
          </button>

          <Breadcrumb />

          <div className="flex items-center gap-3 ml-auto">
            {topBarContent}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-screen-xl">{children}</main>
      </div>
    </div>
  )
}
