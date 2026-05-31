'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavLink = { href: string; label: string; icon: React.ReactNode }

export function SidebarNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname()

  return (
    <ul className="space-y-0.5">
      {links.map((link) => {
        const active =
          pathname === link.href ||
          (link.href !== '/admin' && pathname.startsWith(link.href))
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-pink-600 text-white font-medium'
                  : 'text-pink-200 hover:bg-pink-600 hover:text-white'
              }`}
            >
              <span className="shrink-0">{link.icon}</span>
              {link.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
