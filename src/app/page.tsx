import Link from 'next/link'
import Image from 'next/image'
import MarketingHeader from '@/components/marketing/header'
import MarketingFooter from '@/components/marketing/footer'
import AnnouncementCarousel from '@/components/marketing/announcement-carousel'
import { SERVICES, BRANCH, STEPS } from '@/lib/marketing-data'
import { createClient } from '@/utils/supabase/server'

function formatPrice(price: number) {
  return '₱' + price.toLocaleString('en-PH')
}

export default async function HomePage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('announcements')
    .select('id, title, body, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const announcements = (data ?? []) as { id: string; title: string; body: string | null; created_at: string }[]

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      {/* Hero — cream background from brand palette */}
      <section className="bg-[#FFF5EC] py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-6">
          <div className="max-w-3xl">
           
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight tracking-tight mb-5">
              Professional cleaning
              <br />
              <span className="text-pink-600">you can count on.</span>
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-3">
              Maid For You Cleaning Services in Metro Manila offers different kinds of services.
            </p>
            <p className="text-base text-gray-400 leading-relaxed mb-8 max-w-xl">
              We understand the needs of every unit owner, and our team has the quality and integrity
              to provide you with the best service at an affordable price.
            </p>

            {/* Address — visible in hero */}
            <div className="flex items-start gap-2 mb-8">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-pink-500 shrink-0 mt-0.5">
                <path d="M8 1.5a4.5 4.5 0 014.5 4.5c0 3-4.5 8.5-4.5 8.5S3.5 9 3.5 6A4.5 4.5 0 018 1.5z"/>
                <circle cx="8" cy="6" r="1.5"/>
              </svg>
              <p className="text-sm text-gray-500">{BRANCH.address}</p>
            </div>

            <div className="flex flex-col sm:flex-row items-start gap-3">
              <Link
                href="/register"
                className="px-6 py-3 bg-pink-600 text-white rounded-lg font-semibold text-sm hover:bg-pink-700 transition-colors"
              >
                Create Account
              </Link>
            </div>
            <p className="mt-6 text-xs text-gray-400 border border-orange-200 bg-white rounded-full inline-flex items-center gap-2 px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
              Book via our mobile app
            </p>
          </div>
        </div>
      </section>

      {/* Announcements — horizontal carousel, newest first */}
      <AnnouncementCarousel items={announcements} />

      {/* Services */}
      <section id="services" className="bg-gray-50 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Our Services</h2>
            <p className="text-sm text-gray-500 mt-1">Professional cleaning for every need.</p>
          </div>

          {/* Photo strip — 3-up on all screen sizes */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-10">
            {[
              '/services/s1.jpg',
              '/services/s2.jpg',
              '/services/s3.jpg',
            ].map((src) => (
              <div
                key={src}
                className="relative h-28 sm:h-56 rounded-lg sm:rounded-2xl overflow-hidden group"
              >
                <Image
                  src={src}
                  alt="Maid For You Cleaning Services"
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICES.map((svc) => (
              <div
                key={svc.title}
                className="group rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200"
              >
                {svc.image ? (
                  <div className="relative aspect-square overflow-hidden rounded-t-2xl">
                    <Image
                      src={svc.image}
                      alt={svc.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                  </div>
                ) : (
                  <div className="aspect-square bg-[#FDF2F8] rounded-t-2xl" />
                )}

                <div className="px-5 py-4">
                  <p className="font-semibold text-gray-900 text-sm mb-1.5 leading-snug">{svc.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">{svc.description}</p>
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Starting at</p>
                    <p className="text-sm font-bold text-pink-600">{formatPrice(svc.price)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — cream background */}
      <section id="how-it-works" className="bg-[#FFF5EC] py-16 sm:py-20">
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

      {/* Coverage — address + service areas */}
    <section className="bg-gradient-to-b from-pink-600 from-95% via-pink-600 to-[#FFF5EC] py-14">
  <div className="max-w-6xl mx-auto px-4 sm:px-6">
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">

      {/* Left — address */}
      <div>
        <p className="text-xs font-semibold text-pink-300 uppercase tracking-widest mb-3">Our Location</p>
        <h2 className="text-xl font-bold text-white mb-2">{BRANCH.name}</h2>
        <div className="flex items-start gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-pink-300 shrink-0 mt-0.5">
            <path d="M8 1.5a4.5 4.5 0 014.5 4.5c0 3-4.5 8.5-4.5 8.5S3.5 9 3.5 6A4.5 4.5 0 018 1.5z"/>
            <circle cx="8" cy="6" r="1.5"/>
          </svg>
          <p className="text-pink-100 text-sm">{BRANCH.address}</p>
        </div>
      </div>

      {/* Right — service areas */}
      <div className="lg:max-w-sm">
        <p className="text-xs font-semibold text-pink-300 uppercase tracking-widest mb-3">Service Areas</p>
        <div className="flex flex-wrap gap-2">
          {BRANCH.serviceAreas.map((city) => (
            <span
              key={city}
              className="text-xs bg-white/15 border border-white/25 text-white px-3 py-1 rounded-full"
            >
              {city}
            </span>
          ))}
        </div>
      </div>

      <Link
        href="/register"
        className="px-6 py-3 bg-white text-pink-600 rounded-lg font-semibold text-sm hover:bg-pink-50 transition-colors self-start shrink-0"
      >
        Create account
      </Link>
    </div>
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
            Create Account
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
