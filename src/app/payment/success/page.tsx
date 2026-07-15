import Link from 'next/link'

// Public landing page the customer is redirected to after a successful PayMongo
// checkout (success_url in src/app/api/paymongo/checkout/route.ts). The booking's
// Paid status is set by the webhook — the source of truth — so this page is a
// friendly confirmation and does not itself change any state.
export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>
}) {
  const { booking } = await searchParams
  const ref = booking ? booking.slice(0, 8).toUpperCase() : null

  return (
    <main className="flex-1 flex items-center justify-center bg-gray-50 px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900">Payment received</h1>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Thank you! Your payment is being confirmed. Your booking status will update to
          <span className="font-semibold text-gray-700"> Paid</span> automatically within a few moments.
        </p>

        {ref && (
          <div className="mt-6 inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
            <span className="text-xs text-gray-400">Booking</span>
            <span className="text-sm font-mono font-semibold text-gray-700 tracking-wider">#{ref}</span>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-6 leading-relaxed">
          You can safely close this window and return to the CleanConnect app.
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
