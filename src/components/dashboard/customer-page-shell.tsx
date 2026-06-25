import Image from 'next/image'
import Link from 'next/link'
import { logout } from '@/app/actions/auth'

interface NavLink {
  href: string
  label: string
}

interface Props {
  displayName: string
  activeHref: string
  navLinks: NavLink[]
  children: React.ReactNode
}

export function CustomerPageShell({ displayName, activeHref, navLinks, children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-14 bg-white border-b border-gray-100 px-4 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/customer" className="flex items-center gap-2 shrink-0">
            <Image src="/Logo.webp" alt="Maid For You" width={28} height={28} className="w-7 h-7 object-cover rounded-full" />
            <span className="text-sm font-semibold text-gray-900 hidden sm:inline">Maid For You</span>
          </Link>

          <span className="text-gray-200 hidden sm:inline">|</span>

          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeHref === link.href
                    ? 'bg-pink-50 text-pink-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 hidden sm:inline">{displayName}</span>
          <form action={logout}>
            <button type="submit" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        {children}
      </main>
    </div>
  )
}
