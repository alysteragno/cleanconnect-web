import Link from 'next/link'
import SectionHeader from '@/components/marketing/section-header'
import { SERVICES, BRANCHES } from '@/lib/marketing-data'

export const metadata = { title: 'About — CleanConnect' }

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          Est. 2016
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
          About Cleaning Lady PH
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          We started with one mission: bring reliable, professional cleaning to Filipino homes and
          businesses. Today, we operate across 5 locations with a growing team of certified cleaners.
        </p>
      </section>

      {/* Story */}
      <section className="bg-gray-50 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <SectionHeader title="Our Story" />
          <div className="space-y-4 text-gray-600 leading-relaxed text-sm sm:text-base">
            <p>
              Cleaning Lady PH was founded in 2016 with a single branch in Manila. What began as a
              small team of dedicated cleaners has grown into a trusted cleaning service brand serving
              thousands of households and businesses across the Philippines.
            </p>
            <p>
              We built CleanConnect to bring our operations into the modern era — giving customers the
              ability to book, track, and rate their cleaning service online, while giving our cleaners
              and managers the tools they need to coordinate efficiently.
            </p>
            <p>
              Every cleaner on our platform is background-checked, trained, and assigned to a local
              branch so you always get someone who knows your area.
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SERVICES.map((service) => (
              <div
                key={service.title}
                className="bg-white rounded-xl p-6 border border-gray-100 hover:border-blue-100 hover:shadow-sm transition-all"
              >
                <span className="text-3xl mb-4 block">{service.icon}</span>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{service.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Branches */}
      <section className="bg-blue-600 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Our Branches</h2>
          <p className="text-blue-200 mb-10">5 locations across the Philippines.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {BRANCHES.map((b) => (
              <div
                key={b.city}
                className="bg-white/10 border border-white/20 rounded-xl px-6 py-3 text-white"
              >
                <p className="font-semibold">{b.city}</p>
                <p className="text-xs text-blue-200 mt-0.5">{b.type}</p>
              </div>
            ))}
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
            className="inline-block px-10 py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-base hover:bg-blue-700 transition-colors"
          >
            Create free account
          </Link>
        </div>
      </section>
    </div>
  )
}
