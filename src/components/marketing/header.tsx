'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { NAV_LINKS, CONTACT } from '@/lib/marketing-data'

export default function MarketingHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50">
      {/* Contact bar */}
      <div className="bg-pink-600 text-white text-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-9 flex items-center justify-end gap-5">
          <a href={CONTACT.phoneTel} className="flex items-center gap-1.5 hover:text-pink-200 transition-colors">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 1h3.5l1.5 4-2 1.5a10 10 0 004.5 4.5L12 9l4 1.5V14a1 1 0 01-1 1C6.163 15 1 9.837 1 3.5A1 1 0 012 2.5L3 1z"/>
            </svg>
            {CONTACT.phone}
          </a>
          <a href={`mailto:${CONTACT.email}`} className="hidden sm:flex items-center gap-1.5 hover:text-pink-200 transition-colors">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="14" height="10" rx="1.5"/>
              <path d="M1 4l7 5 7-5"/>
            </svg>
            {CONTACT.email}
          </a>
          <a href={CONTACT.messengerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-pink-200 transition-colors" aria-label="Messenger">
            <Image src="/messenger-fill.svg" alt="Messenger" width={13} height={13} className="brightness-0 invert" />
          </a>
          <a href={CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-pink-200 transition-colors" aria-label="WhatsApp">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.528 5.845L.057 23.272a.75.75 0 00.914.913l5.487-1.449A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.898 0-3.676-.52-5.198-1.424l-.37-.216-3.84 1.016 1.03-3.752-.234-.384A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
          </a>
        </div>
      </div>

      {/* Main nav */}
      <div className="bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/Logo.jpg"
              alt="Maid For You Cleaning Services"
              width={140}
              height={40}
              className="h-10 w-auto object-contain"
              priority
            />
          </Link>

          <nav className="hidden sm:flex items-center gap-6 text-sm">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  pathname === link.href
                    ? 'text-gray-900 font-medium'
                    : 'text-gray-500 hover:text-gray-900 transition-colors'
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </header>
  )
}
