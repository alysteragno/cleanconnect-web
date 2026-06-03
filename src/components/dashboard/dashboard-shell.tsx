'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface Props {
  sidebarContent: React.ReactNode
  topBarContent: React.ReactNode
  children: React.ReactNode
}

export function DashboardShell({ sidebarContent, topBarContent, children }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-20 md:hidden transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-56 bg-pink-700 flex flex-col transition-all duration-300 ease-out ${
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
        <header className="h-14 bg-white border-b border-gray-100 px-4 md:px-6 flex items-center sticky top-0 z-10">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center justify-center w-11 h-11 -ml-2 mr-1 rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors md:hidden shrink-0"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="pointer-events-none">
                <path d="M4 4l12 12M16 4L4 16"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="pointer-events-none">
                <path d="M3 5h14M3 10h14M3 15h14"/>
              </svg>
            )}
          </button>
          <div className="text-sm text-gray-400 hidden md:block">
            Maid For You Cleaning Services &mdash; Admin Portal
          </div>
          <div className="flex items-center gap-3 ml-auto">
            {topBarContent}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-screen-xl">{children}</main>
      </div>
    </div>
  )
}
