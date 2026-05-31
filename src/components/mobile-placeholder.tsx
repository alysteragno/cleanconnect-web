import Image from 'next/image'
import Link from 'next/link'
import { logout } from '@/app/actions/auth'

export default function MobileAppPlaceholder({ role }: { role: 'customer' | 'cleaner' }) {
  const isCustomer = role === 'customer'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-md w-full space-y-6">

        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src="/Logo.jpg"
            alt="Maid For You Cleaning Services"
            width={160}
            height={50}
            className="h-14 w-auto object-contain"
            priority
          />
        </div>

        {/* Mobile icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl">
            📱
          </div>
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {isCustomer ? 'Book on the Mobile App' : 'Manage Jobs on the Mobile App'}
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            {isCustomer
              ? 'Booking, scheduling, and tracking your cleaning services are available on the Maid For You mobile app.'
              : 'View assigned jobs, update availability, and manage your schedule on the Maid For You mobile app.'}
          </p>
        </div>

        {/* App store badges placeholder */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 justify-center px-5 py-3 bg-gray-900 text-white rounded-xl opacity-50 cursor-not-allowed">
            <span className="text-xl"></span>
            <div className="text-left">
              <p className="text-xs text-gray-300">Coming soon on</p>
              <p className="text-sm font-semibold">App Store</p>
            </div>
          </div>
          <div className="flex items-center gap-3 justify-center px-5 py-3 bg-gray-900 text-white rounded-xl opacity-50 cursor-not-allowed">
            <span className="text-xl">▶</span>
            <div className="text-left">
              <p className="text-xs text-gray-300">Coming soon on</p>
              <p className="text-sm font-semibold">Google Play</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          The mobile app is currently in development. We&apos;ll notify you when it&apos;s ready.
        </p>

        {/* Sign out */}
        <div className="border-t border-gray-100 pt-4">
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Contact */}
      <p className="mt-6 text-xs text-gray-400">
        Need help?{' '}
        <Link href="/contact" className="underline hover:text-gray-600 transition-colors">
          Contact us
        </Link>
      </p>
    </div>
  )
}
