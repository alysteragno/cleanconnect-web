import Link from 'next/link'
import Image from 'next/image'
import MarketingHeader from '@/components/marketing/header'
import MarketingFooter from '@/components/marketing/footer'
import { SERVICES, BRANCH, STEPS } from '@/lib/marketing-data'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-3xl">
          <div className="mb-6">
            <Image
              src="/Logo.jpg"
              alt="Maid For You Cleaning Services"
              width={180}
              height={54}
              className="h-14 w-auto object-contain"
              priority
            />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight tracking-tight mb-5">
            Professional cleaning
            <br />
            <span className="text-pink-600">you can count on.</span>
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed mb-4">
            Maid For You Cleaning Services in Metro Manila offers different kinds of services.
          </p>
          <p className="text-base text-gray-400 leading-relaxed mb-8 max-w-xl">
            We understand the needs of every unit owner, and our team has the quality and integrity
            to provide you with the best service at an affordable price.
          </p>
          <div className="flex flex-col sm:flex-row items-start gap-3">
            <Link
              href="/register"
              className="px-6 py-3 bg-pink-600 text-white rounded-lg font-semibold text-sm hover:bg-pink-700 transition-colors"
            >
              Download the App
            </Link>
            <a
              href="#services"
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-200 transition-colors"
            >
              View services
            </a>
          </div>
          <p className="mt-6 text-xs text-gray-400 border border-gray-200 rounded-full inline-flex items-center gap-2 px-4 py-2">
            <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
            Book via our mobile app &mdash; coming soon on iOS &amp; Android
          </p>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="bg-gray-50 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Our Services</h2>
            <p className="text-sm text-gray-500 mt-1">Professional cleaning for every need.</p>
          </div>
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

      {/* How it works */}
      <section id="how-it-works" className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">How It Works</h2>
            <p className="text-sm text-gray-500 mt-1">Three steps to a cleaner space.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STEPS.map((item, i) => (
              <div key={item.step} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-pink-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">{item.title}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section className="bg-pink-600 py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xs font-semibold text-pink-300 uppercase tracking-widest mb-2">Service Area</p>
            <h2 className="text-2xl font-bold text-white">{BRANCH.name}</h2>
            <p className="text-pink-200 mt-1 text-sm">{BRANCH.area} &mdash; {BRANCH.phone}</p>
          </div>
          <Link
            href="/register"
            className="px-6 py-3 bg-white text-pink-600 rounded-lg font-semibold text-sm hover:bg-pink-50 transition-colors shrink-0"
          >
            Create account
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready for a cleaner home?</h2>
          <p className="text-gray-500 text-sm mb-2">
            Book through our mobile app &mdash; available soon on iOS and Android.
          </p>
          <p className="text-gray-400 text-xs mb-8">Create a free account now to be ready when the app launches.</p>
          <Link
            href="/register"
            className="inline-block px-8 py-3 bg-pink-600 text-white rounded-lg font-semibold text-sm hover:bg-pink-700 transition-colors"
          >
            Download the App
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
