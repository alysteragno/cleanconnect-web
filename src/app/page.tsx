import Link from 'next/link'
import Image from 'next/image'
import MarketingHeader from '@/components/marketing/header'
import MarketingFooter from '@/components/marketing/footer'
import SectionHeader from '@/components/marketing/section-header'
import { SERVICES, BRANCH, STEPS } from '@/lib/marketing-data'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
        <div className="flex justify-center mb-8">
          <Image
            src="/Logo.jpg"
            alt="Maid For You Cleaning Services"
            width={200}
            height={60}
            className="h-16 w-auto object-contain"
            priority
          />
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
          Professional Cleaning
          <br className="hidden sm:block" />
          <span className="text-blue-600"> You Can Trust</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-4">
          Maid For You Cleaning Services in Metro Manila offers different kinds of services.
        </p>
        <p className="text-base text-gray-400 max-w-2xl mx-auto mb-10">
          We understand the needs of every unit owner, and our team has the quality and integrity
          to provide you with the best service we offer at an affordable price.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-base hover:bg-blue-700 transition-colors"
          >
            Create an account
          </Link>
          <a
            href="#services"
            className="w-full sm:w-auto px-8 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-base hover:bg-gray-200 transition-colors"
          >
            Our services
          </a>
        </div>

        {/* Mobile app notice */}
        <div className="mt-10 inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-sm px-4 py-2.5 rounded-full">
          <span>📱</span>
          <span>Book your service via our mobile app — coming soon on iOS &amp; Android</span>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="bg-gray-50 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHeader
            title="Our Services"
            subtitle="Professional cleaning for every need, done right every time."
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

      {/* How it Works */}
      <section id="how-it-works" className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHeader
            title="How It Works"
            subtitle="Three simple steps to a cleaner home."
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {STEPS.map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center text-lg font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section id="coverage" className="bg-blue-600 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Where We Operate</h2>
          <p className="text-blue-200 mb-10">
            Proudly serving Metro Manila (NCR) — bringing professional cleaning to your doorstep.
          </p>
          <div className="flex justify-center">
            <div className="bg-white/10 border border-white/20 rounded-xl px-8 py-4 text-white">
              <p className="font-semibold text-lg">{BRANCH.name}</p>
              <p className="text-sm text-blue-200 mt-1">{BRANCH.area}</p>
              <p className="text-sm text-blue-200 mt-0.5">{BRANCH.phone}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Ready for a cleaner home?</h2>
          <p className="text-gray-500 mb-2">
            Book through our mobile app — available soon on iOS and Android.
          </p>
          <p className="text-gray-400 text-sm mb-8">
            Create a free account now to be ready when the app launches.
          </p>
          <Link
            href="/register"
            className="inline-block px-10 py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-base hover:bg-blue-700 transition-colors"
          >
            Create free account
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
