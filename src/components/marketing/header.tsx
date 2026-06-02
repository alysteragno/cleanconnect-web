'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { NAV_LINKS, CONTACT } from '@/lib/marketing-data'

export default function MarketingHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Close menu on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <header className="sticky top-0 z-50">

        {/* Contact bar */}
        <div className="bg-pink-600 text-white text-xs">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-9 flex items-center justify-end gap-4 sm:gap-5">
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
            <a href={CONTACT.messengerUrl} target="_blank" rel="noopener noreferrer" className="hover:text-pink-200 transition-colors" aria-label="Messenger">
              <Image src="/messenger-fill.svg" alt="Messenger" width={17} height={17} className="brightness-0 invert" />
            </a>
            <a href={CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer" className="hover:text-pink-200 transition-colors" aria-label="WhatsApp">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.528 5.845L.057 23.272a.75.75 0 00.914.913l5.487-1.449A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.898 0-3.676-.52-5.198-1.424l-.37-.216-3.84 1.016 1.03-3.752-.234-.384A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Main nav */}
        <div className="bg-white/95 backdrop-blur border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <Image
                src="/Logo.webp"
                alt="Maid For You Cleaning Services"
                width={140}
                height={40}
                className="h-10 w-auto object-contain"
                priority
              />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-6 text-sm">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={pathname === link.href
                    ? 'text-gray-900 font-medium'
                    : 'text-gray-500 hover:text-gray-900 transition-colors'}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              {/* Desktop social icons */}
              <div className="hidden sm:flex items-center gap-2">
                <a href={CONTACT.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="hover:opacity-75 transition-opacity">
                  <Image src="/Facebook.svg" alt="Facebook" width={20} height={20} />
                </a>
                <a href={CONTACT.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hover:opacity-75 transition-opacity">
                  <Image src="/Instagram.svg" alt="Instagram" width={20} height={20} />
                </a>
                <a href={CONTACT.twitterUrl} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="hover:opacity-75 transition-opacity">
                  <Image src="/Twitter.svg" alt="X" width={18} height={18} />
                </a>
              </div>

              {/* Desktop sign in */}
              <Link
                href="/login"
                className="hidden sm:block text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Sign in
              </Link>

              {/* Hamburger — mobile only */}
              <button
                onClick={() => setOpen((v) => !v)}
                className="sm:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
              >
                {open ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <path d="M4 4l12 12M16 4L4 16"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <path d="M3 5h14M3 10h14M3 15h14"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu panel — always mounted, animated with max-height + opacity */}
        <div
          className={`sm:hidden overflow-hidden bg-white border-b border-gray-100 shadow-lg transition-all duration-300 ease-out ${
            open ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-4 pt-2 pb-5 space-y-0.5">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? 'bg-pink-50 text-pink-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/login"
                className="block px-3 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Sign in
              </Link>

              {/* Contact shortcuts */}
              <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
                <a
                  href={CONTACT.phoneTel}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-pink-500 shrink-0">
                    <path d="M3 1h3.5l1.5 4-2 1.5a10 10 0 004.5 4.5L12 9l4 1.5V14a1 1 0 01-1 1C6.163 15 1 9.837 1 3.5A1 1 0 012 2.5L3 1z"/>
                  </svg>
                  {CONTACT.phone}
                </a>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-pink-500 shrink-0">
                    <rect x="1" y="3" width="14" height="10" rx="1.5"/>
                    <path d="M1 4l7 5 7-5"/>
                  </svg>
                  {CONTACT.email}
                </a>
                <div className="flex gap-2 px-3 pt-1">
                  <a
                    href={CONTACT.messengerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 bg-pink-50 text-pink-700 rounded-lg text-xs font-medium hover:bg-pink-100 transition-colors"
                  >
                    <Image src="/messenger-fill.svg" alt="" width={13} height={13} style={{ filter: 'invert(35%) sepia(80%) saturate(600%) hue-rotate(290deg)' }} />
                    Messenger
                  </a>
                  <a
                    href={CONTACT.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 bg-pink-50 text-pink-700 rounded-lg text-xs font-medium hover:bg-pink-100 transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.528 5.845L.057 23.272a.75.75 0 00.914.913l5.487-1.449A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.898 0-3.676-.52-5.198-1.424l-.37-.216-3.84 1.016 1.03-3.752-.234-.384A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                    </svg>
                    WhatsApp
                  </a>
                </div>
                <div className="flex items-center gap-3 px-3 pt-2">
                  <a href={CONTACT.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="hover:opacity-75 transition-opacity">
                    <Image src="/Facebook.svg" alt="Facebook" width={22} height={22} />
                  </a>
                  <a href={CONTACT.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hover:opacity-75 transition-opacity">
                    <Image src="/Instagram.svg" alt="Instagram" width={22} height={22} />
                  </a>
                  <a href={CONTACT.twitterUrl} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="hover:opacity-75 transition-opacity">
                    <Image src="/Twitter.svg" alt="X" width={20} height={20} />
                  </a>
                </div>
              </div>
          </div>
        </div>
      </header>

      {/* Backdrop — always mounted, fades in/out */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 sm:hidden transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
    </>
  )
}
