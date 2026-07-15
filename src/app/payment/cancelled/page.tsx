import Link from 'next/link'

// Public landing page the customer is redirected to if they cancel or abandon the
// PayMongo checkout (cancel_url in src/app/api/paymongo/checkout/route.ts). The
// booking is left unpaid; the same checkout link can be reused to try again.
export default async function PaymentCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>
}) {
  const { booking } = await searchParams
  const ref = booking ? booking.slice(0, 8).toUpperCase() : null

  return (
    <main className="flex-1 flex items-center justify-center bg-gray-50 px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900">Payment not completed</h1>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Your payment was cancelled and your booking remains
          <span className="font-semibold text-gray-700"> unpaid</span>. No charge was made —
          you can try again anytime using the same payment link.
        </p>

        {ref && (
          <div className="mt-6 inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
            <span className="text-xs text-gray-400">Booking</span>
            <span className="text-sm font-mono font-semibold text-gray-700 tracking-wider">#{ref}</span>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-6 leading-relaxed">
          Return to the CleanConnect app to retry your payment or contact support if you need help.
        </p>

        <Link
          href="/"
          className="inline-block mt-6 px-6 py-2.5 bg-pink-600 text-white rounded-xl text-sm font-semibold hover:bg-pink-700 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}
