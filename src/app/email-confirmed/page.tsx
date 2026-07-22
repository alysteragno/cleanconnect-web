import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import MobileAppPlaceholder from '@/components/mobile-placeholder'

export const metadata: Metadata = {
  title: 'Email Confirmed — Maid For You Cleaning Services',
  description: 'Your Maid For You account is confirmed. Continue on the mobile app.',
}

export default async function EmailConfirmedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Default to the customer variant if the session didn't come through for
  // some reason (verifyOtp in /auth/callback should always have set one
  // right before redirecting here) — this page is purely a friendly landing
  // spot, so there's nothing worth gating behind a login redirect.
  let role: 'customer' | 'cleaner' = 'customer'
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role === 'cleaner') role = 'cleaner'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Email confirmed</h1>
        <p className="text-sm text-gray-500 mt-1.5">
          Your account is active. Continue on the mobile app to get started.
        </p>
      </div>

      <MobileAppPlaceholder role={role} fullPage={false} />
    </div>
  )
}
