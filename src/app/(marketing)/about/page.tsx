import Link from 'next/link'
import SectionHeader from '@/components/marketing/section-header'
import { SERVICES, BRANCH } from '@/lib/marketing-data'

export const metadata = { title: 'About — CleanConnect' }

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-pink-50 text-pink-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          Est. 2016
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
          About Maid For You Cleaning Services
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-4">
          Maid For You Cleaning Services in Metro Manila offers different kinds of services.
        </p>
        <p className="text-base text-gray-400 max-w-2xl mx-auto">
          We understand the needs of every unit owner, and our team has the quality and integrity
          to provide you with the best service we offer at an affordable price.
        </p>
      </section>

      {/* Story */}
      <section className="bg-gray-50 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <SectionHeader title="Our Story" />
          <div className="space-y-4 text-gray-600 leading-relaxed text-sm sm:text-base">
            <p>
              Maid For You Cleaning Services was founded in 2016 in Metro Manila. What began as a small team of
              dedicated cleaners has grown into a trusted cleaning service brand serving thousands of
              households and businesses across the NCR.
            </p>
            <p>
              We built CleanConnect to bring our operations into the modern era — giving customers the
              ability to book, track, and rate their cleaning service online, while giving our cleaners
              and managers the tools they need to coordinate efficiently.
            </p>
            <p>
              Every cleaner on our platform is background-checked, trained, and committed to delivering
              consistent, high-quality results across Metro Manila.
            </p>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHeader
            title="What We Offer"
            subtitle="Professional cleaning services tailored to every need."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
            {SERVICES.map((service) => (
              <div
                key={service.title}
                className="bg-white px-6 py-5 hover:bg-pink-50 transition-colors"
              >
                <p className="text-sm font-semibold text-gray-900 mb-1.5">{service.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section className="bg-pink-600 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Where We Operate</h2>
          <p className="text-pink-200 mb-10">Serving Metro Manila (NCR).</p>
          <div className="flex justify-center">
            <div className="bg-white/10 border border-white/20 rounded-xl px-8 py-4 text-white">
              <p className="font-semibold text-lg">{BRANCH.name}</p>
              <p className="text-sm text-pink-200 mt-1">{BRANCH.area}</p>
              <p className="text-sm text-pink-200 mt-0.5">{BRANCH.phone}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 text-center">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Ready to get started?</h2>
          <p className="text-gray-500 mb-8">Book your first cleaning online in under 2 minutes.</p>
          <Link
            href="/register"
            className="inline-block px-10 py-3.5 bg-pink-600 text-white rounded-xl font-semibold text-base hover:bg-pink-700 transition-colors"
          >
            Create free account
          </Link>
        </div>
      </section>
    </div>
  )
}
