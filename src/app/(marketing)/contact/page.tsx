import Link from 'next/link'
import SectionHeader from '@/components/marketing/section-header'
import { BRANCH } from '@/lib/marketing-data'

export const metadata = { title: 'Contact — CleanConnect' }

export default function ContactPage() {
  return (
    <div>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">Get in Touch</h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          Reach us at our office or book your service directly online.
        </p>
      </section>

      {/* Contact info */}
      <section className="bg-gray-50 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <SectionHeader
            title="Our Office"
            subtitle="Walk in or give us a call."
          />
          <div className="flex justify-center">
            <div className="bg-white rounded-xl border border-gray-100 p-6 hover:border-blue-100 hover:shadow-sm transition-all w-full max-w-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900">{BRANCH.name}</h3>
                <span className="text-xs bg-blue-50 text-blue-600 font-medium px-2 py-0.5 rounded-full">
                  NCR
                </span>
              </div>
              <p className="text-sm text-gray-500">{BRANCH.area}</p>
              <p className="text-sm text-gray-500 mt-1">{BRANCH.phone}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Book online CTA */}
      <section className="py-16 sm:py-20">
        <div className="max-w-xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Fastest way to reach us?</h2>
          <p className="text-gray-500 mb-8">
            Book online and our team will confirm your schedule and assign a cleaner within the hour.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="px-8 py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-base hover:bg-blue-700 transition-colors"
            >
              Book a cleaning
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-base hover:bg-gray-200 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
