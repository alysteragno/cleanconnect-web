import Link from 'next/link'
import Image from 'next/image'
import { NAV_LINKS } from '@/lib/marketing-data'

export default function MarketingFooter() {
  return (
    <footer className="border-t border-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/Logo.jpg"
            alt="Maid For You Cleaning Services"
            width={100}
            height={32}
            className="h-8 w-auto object-contain"
          />
        </Link>
        <span>© {new Date().getFullYear()} Maid For You Cleaning Services. All rights reserved.</span>
        <div className="flex gap-4">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-gray-600 transition-colors">
              {link.label}
            </Link>
          ))}
          <Link href="/login" className="hover:text-gray-600 transition-colors">Sign in</Link>
        </div>
      </div>
    </footer>
  )
}
