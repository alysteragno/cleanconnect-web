import Link from 'next/link'

const SERVICES = [
  {
    title: 'General Home Cleaning',
    description: 'Complete top-to-bottom cleaning of your home — floors, surfaces, bathrooms, and kitchen included.',
    icon: '🏠',
  },
  {
    title: 'Premium Mattress & Upholstery',
    description: 'Deep cleaning and sanitizing of mattresses, sofas, and upholstered furniture.',
    icon: '🛋️',
  },
  {
    title: 'Complete Home Package',
    description: 'Comprehensive cleaning with steam sterilization for a hygienic, hotel-quality result.',
    icon: '✨',
  },
  {
    title: 'Disinfection Services',
    description: 'Professional-grade disinfection to eliminate bacteria, viruses, and allergens from your space.',
    icon: '🧴',
  },
  {
    title: 'Post-Construction Cleaning',
    description: 'Thorough removal of construction dust, debris, and residues after renovation or building work.',
    icon: '🔨',
  },
  {
    title: 'Deep Cleaning Add-ons',
    description: 'Customize your service with extra hours, additional cleaners, or specialized cleaning tasks.',
    icon: '➕',
  },
]

const BRANCHES = [
  { city: 'Manila', type: 'Main Branch' },
  { city: 'Cebu', type: 'Branch' },
  { city: 'Baguio', type: 'Branch' },
  { city: 'Quezon City', type: 'Franchise' },
  { city: 'Muntinlupa', type: 'Franchise' },
]

const STEPS = [
  {
    step: '01',
    title: 'Book Online',
    description:
      'Enter your address and property details. Get an instant price estimate powered by our pricing engine.',
  },
  {
    step: '02',
    title: 'We Assign a Cleaner',
    description:
      'Our system matches you with the nearest available, qualified cleaner from your branch.',
  },
  {
    step: '03',
    title: 'Sit Back & Relax',
    description:
      "Your cleaner arrives, completes the job, and you rate the service when it's done.",
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-blue-600">CleanConnect</span>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-500">
            <a href="#services" className="hover:text-gray-900 transition-colors">Services</a>
            <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How it works</a>
            <a href="#coverage" className="hover:text-gray-900 transition-colors">Coverage</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          Serving the Philippines since 2016
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
          Professional Cleaning
          <br className="hidden sm:block" />
          <span className="text-blue-600"> You Can Trust</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10">
          Cleaning Lady PH brings certified cleaners to your home across 5 locations in
          the Philippines. Book online in minutes and track your service in real time.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-base hover:bg-blue-700 transition-colors"
          >
            Book a cleaning
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto px-8 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-base hover:bg-gray-200 transition-colors"
          >
            How it works
          </a>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="bg-gray-50 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Our Services</h2>
            <p className="text-gray-500">Professional cleaning for every need, done right every time.</p>
          </div>
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
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">How It Works</h2>
            <p className="text-gray-500">Three simple steps to a cleaner home.</p>
          </div>
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
            5 locations across the Philippines — we&apos;re closer than you think.
          </p>
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

      {/* Final CTA */}
      <section className="py-16 sm:py-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Ready for a cleaner home?</h2>
          <p className="text-gray-500 mb-8">
            Create your free account and book your first cleaning in under 2 minutes.
          </p>
          <Link
            href="/register"
            className="inline-block px-10 py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-base hover:bg-blue-700 transition-colors"
          >
            Create free account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <span className="font-semibold text-blue-600">CleanConnect</span>
          <span>© 2026 Cleaning Lady PH. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-gray-600 transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-gray-600 transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
