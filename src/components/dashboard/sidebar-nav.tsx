'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavLink = { href: string; label: string; icon: React.ReactNode }

export function SidebarNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname()

  return (
    <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
      {links.map((link) => {
        const active = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href))
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              active
                ? 'bg-pink-50 text-pink-700 font-medium'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span className={`shrink-0 ${active ? 'text-pink-600' : 'text-gray-400'}`}>
              {link.icon}
            </span>
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
