import Image from 'next/image'
import { logout } from '@/app/actions/auth'

export default function MobileAppPlaceholder({
  role,
  showSignOut = true,
  fullPage = true,
}: {
  role: 'customer' | 'cleaner'
  showSignOut?: boolean
  /** false to render just the card, for embedding inside another page's layout instead of owning the full viewport. */
  fullPage?: boolean
}) {

  const card = (
      <div className="bg-white rounded-2xl border border-gray-200 p-10 max-w-sm w-full text-center space-y-6 mx-auto">

        {fullPage && (
          <div className="flex justify-center">
            <Image
              src="/Logo.webp"
              alt="Maid For You Cleaning Services"
              width={150}
              height={46}
              className="h-12 w-auto object-contain"
              priority
            />
          </div>
        )}

        <div className="w-12 h-12 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center mx-auto">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-pink-600 stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="1" width="10" height="18" rx="2" />
            <path d="M8.5 15.5h3" />
          </svg>
        </div>

        <div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            {role === 'customer' ? 'Book on the Mobile App' : 'Manage Jobs on the Mobile App'}
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            {role === 'customer'
              ? 'Booking, scheduling, and tracking your cleaning services are available on the Maid For You mobile app.'
              : 'View assigned jobs, update your availability, and manage your schedule on the mobile app.'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 px-5 py-3 bg-gray-900 text-white rounded-xl opacity-40 cursor-not-allowed">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" className="shrink-0">
              <path d="M12.5 1H5.5a2 2 0 00-2 2v12a2 2 0 002 2h7a2 2 0 002-2V3a2 2 0 00-2-2zM9 15.5a1 1 0 110-2 1 1 0 010 2z"/>
            </svg>
            <div className="text-left">
              <p className="text-xs text-gray-400 leading-none">Coming soon on</p>
              <p className="text-sm font-semibold leading-tight mt-0.5">App Store</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-3 bg-gray-900 text-white rounded-xl opacity-40 cursor-not-allowed">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" className="shrink-0">
              <path d="M2 2.5L9.5 9 2 15.5V2.5zM3.5 1.5l11 7-11 7V1.5z"/>
            </svg>
            <div className="text-left">
              <p className="text-xs text-gray-400 leading-none">Coming soon on</p>
              <p className="text-sm font-semibold leading-tight mt-0.5">Google Play</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          The mobile app is currently in development. We will notify you when it is ready.
        </p>

        {showSignOut && (
          <div className="border-t border-gray-100 pt-4">
            <form action={logout}>
              <button type="submit" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
  )

  if (!fullPage) return card

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {card}
    </div>
  )
}
