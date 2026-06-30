import Link from 'next/link'
import Image from 'next/image'
import { NAV_LINKS, CONTACT } from '@/lib/marketing-data'
import pkg from '../../../package.json'

const FOOTER_CONTACTS: { href: string; label: string; icon: React.ReactNode; external?: boolean }[] = [
  {
    href: CONTACT.phoneTel,
    label: CONTACT.phone,
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M3 1h3.5l1.5 4-2 1.5a10 10 0 004.5 4.5L12 9l4 1.5V14a1 1 0 01-1 1C6.163 15 1 9.837 1 3.5A1 1 0 012 2.5L3 1z"/>
      </svg>
    ),
  },
  {
    href: `mailto:${CONTACT.email}`,
    label: CONTACT.email,
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M1 4l7 5 7-5"/>
      </svg>
    ),
  },
  {
    href: CONTACT.messengerUrl,
    label: 'Messenger',
    icon: <Image src="/messenger.svg" alt="" width={14} height={14} className="shrink-0 opacity-60" />,
    external: true,
  },
  {
    href: CONTACT.whatsappUrl,
    label: 'WhatsApp',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 opacity-60">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.528 5.845L.057 23.272a.75.75 0 00.914.913l5.487-1.449A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.898 0-3.676-.52-5.198-1.424l-.37-.216-3.84 1.016 1.03-3.752-.234-.384A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
      </svg>
    ),
    external: true,
  },
  {
    href: CONTACT.facebookUrl,
    label: 'Facebook',
    icon: <Image src="/Facebook.svg" alt="" width={14} height={14} className="shrink-0 opacity-80" />,
    external: true,
  },
  {
    href: CONTACT.instagramUrl,
    label: 'Instagram',
    icon: <Image src="/Instagram.svg" alt="" width={14} height={14} className="shrink-0 opacity-80" />,
    external: true,
  },
  {
    href: CONTACT.twitterUrl,
    label: 'X (Twitter)',
    icon: <Image src="/Twitter.svg" alt="" width={14} height={14} className="shrink-0 opacity-60" />,
    external: true,
  },
]

export default function MarketingFooter() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">

          {/* Brand */}
          <div>
            <Link href="/">
              <Image
                src="/Logo.webp"
                alt="Maid For You Cleaning Services"
                width={110}
                height={34}
                className="h-9 w-auto object-contain mb-3"
              />
            </Link>
            <p className="text-xs text-gray-400 leading-relaxed">
              Professional cleaning services in Metro Manila. Serving homes, condos, and offices since 2021.
            </p>
          </div>

          {/* Nav */}
          <div>
            <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">Navigation</p>
            <div className="space-y-2">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">
                  {link.label}
                </Link>
              ))}
              <Link href="/login" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">
                Sign in
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">Contact</p>
            <div className="space-y-2.5">
              {FOOTER_CONTACTS.map(({ href, label, icon, external }) => (
                <a
                  key={href}
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-pink-600 transition-colors"
                >
                  {icon}
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 mt-8 pt-6 text-center">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Maid For You Cleaning Services. All rights reserved.
          </p> 
          <p className="text-xs text-gray-400">Developed by SyncLab <span className="text-gray-300">|</span> v{pkg.version}</p>
        </div>
      </div>
    </footer>
  )
}
