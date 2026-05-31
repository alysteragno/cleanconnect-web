import Image from 'next/image'
import Link from 'next/link'
import { BRANCH, CONTACT } from '@/lib/marketing-data'

export const metadata = { title: 'Contact — Maid For You Cleaning Services' }

function ContactRow({ icon, label, href, children }: {
  icon: React.ReactNode
  label: string
  href: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-pink-200 hover:bg-pink-50 transition-all group"
    >
      <div className="w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-white flex items-center justify-center shrink-0 border border-gray-200 transition-colors">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-sm font-semibold text-gray-900">{children}</p>
      </div>
    </a>
  )
}

export default function ContactPage() {
  return (
    <div>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-3">Get in Touch</h1>
          <p className="text-gray-500">
            Reach us directly by phone, email, or message. We respond quickly.
          </p>
        </div>
      </section>

      {/* Contact methods + branch */}
      <section className="bg-gray-50 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-10">

          {/* Contact channels */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Reach us on</p>

            <ContactRow
              label="Mobile"
              href={CONTACT.phoneTel}
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-pink-600">
                  <path d="M3 1h3.5l1.5 4-2 1.5a10 10 0 004.5 4.5L12 9l4 1.5V14a1 1 0 01-1 1C6.163 15 1 9.837 1 3.5A1 1 0 012 2.5L3 1z"/>
                </svg>
              }
            >
              {CONTACT.phone}
            </ContactRow>

            <ContactRow
              label="Email"
              href={`mailto:${CONTACT.email}`}
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-pink-600">
                  <rect x="1" y="3" width="14" height="10" rx="1.5"/>
                  <path d="M1 4l7 5 7-5"/>
                </svg>
              }
            >
              {CONTACT.email}
            </ContactRow>

            <ContactRow
              label="Facebook Messenger"
              href={CONTACT.messengerUrl}
              icon={
                <Image src="/messenger-fill.svg" alt="" width={16} height={16} className="text-pink-600" style={{ filter: 'invert(40%) sepia(100%) saturate(500%) hue-rotate(280deg)' }} />
              }
            >
              Message us on Messenger
            </ContactRow>

            <ContactRow
              label="WhatsApp"
              href={CONTACT.whatsappUrl}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-pink-600">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.528 5.845L.057 23.272a.75.75 0 00.914.913l5.487-1.449A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.898 0-3.676-.52-5.198-1.424l-.37-.216-3.84 1.016 1.03-3.752-.234-.384A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
              }
            >
              +63 945 889 0338
            </ContactRow>
          </div>

          {/* Branch info */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Our Branch</p>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-gray-900">{BRANCH.name}</p>
                <span className="text-xs bg-pink-50 text-pink-600 border border-pink-200 font-medium px-2 py-0.5 rounded-full">
                  NCR Only
                </span>
              </div>
              <p className="text-sm text-gray-500">{BRANCH.area}</p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400">Service coverage</p>
                <p className="text-sm text-gray-700 mt-1">
                  We serve all cities within Metro Manila (National Capital Region).
                  Bookings outside NCR are not accepted.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14">
        <div className="max-w-xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to book?</h2>
          <p className="text-gray-500 text-sm mb-6">
            Create an account and book through our mobile app when it launches.
          </p>
          <Link
            href="/register"
            className="inline-block px-8 py-3 bg-pink-600 text-white rounded-lg font-semibold text-sm hover:bg-pink-700 transition-colors"
          >
            Create account
          </Link>
        </div>
      </section>
    </div>
  )
}
