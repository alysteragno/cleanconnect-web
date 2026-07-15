'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type NavLink = { href: string; label: string; icon: React.ReactNode; exact?: boolean }
export type NavSection = { label: string; links: NavLink[] }

function NavItem({ link }: { link: NavLink }) {
  const pathname = usePathname()
  const active = link.exact
    ? pathname === link.href
    : pathname === link.href || pathname.startsWith(`${link.href}/`)

  return (
    <li>
      <Link
        href={link.href}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
          active
            ? 'bg-white/20 text-white font-semibold shadow-sm'
            : 'text-pink-200 hover:bg-white/10 hover:text-white'
        }`}
      >
        <span className={`shrink-0 transition-transform duration-150 ${active ? 'scale-110' : ''}`}>
          {link.icon}
        </span>
        <span className="truncate">{link.label}</span>
        {active && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white shrink-0" />
        )}
      </Link>
    </li>
  )
}

export function SidebarNav({ sections }: { sections: NavSection[] }) {
  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="text-[10px] font-bold text-pink-300/60 uppercase tracking-widest px-3 mb-1">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.links.map((link) => (
              <NavItem key={link.href} link={link} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
