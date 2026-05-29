import Link from 'next/link'

const FAQS = [
  {
    q: 'How do I book a cleaning service?',
    a: 'From your dashboard, click "Book a Service" and follow the 5-step form: address, service details, schedule, review, and payment.',
  },
  {
    q: 'How is the price calculated?',
    a: 'Pricing is based on your property size (sqm). The estimate is shown instantly as you enter your sqm. Final price is confirmed after booking.',
  },
  {
    q: 'Can I cancel a booking?',
    a: 'Please contact your branch directly to cancel or reschedule. Cancellation policies may vary by branch.',
  },
  {
    q: 'When will the cleaner arrive?',
    a: 'Once your booking is confirmed, the cleaner will arrive within a 2-hour window from your scheduled time.',
  },
  {
    q: 'How do I pay?',
    a: 'Cash payment to the cleaner on completion is available now. GCash and card payments are coming soon.',
  },
  {
    q: 'How do I leave feedback?',
    a: 'After your booking is marked "Completed", open the booking from My Bookings and tap "Leave feedback".',
  },
]

export default function HelpPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/customer" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Help & Support</h1>
        <p className="text-sm text-gray-500 mt-0.5">Frequently asked questions.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {FAQS.map((faq) => (
          <details key={faq.q} className="group p-4 cursor-pointer">
            <summary className="flex items-center justify-between text-sm font-medium text-gray-900 list-none">
              {faq.q}
              <span className="text-gray-400 group-open:rotate-180 transition-transform text-xs ml-3 shrink-0">
                ▼
              </span>
            </summary>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed">{faq.a}</p>
          </details>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm text-blue-800">
        <p className="font-semibold mb-1">Still need help?</p>
        <p className="text-blue-700">
          Contact your branch directly or reach us at{' '}
          <a href="mailto:support@cleaningladyph.com" className="underline hover:no-underline">
            support@cleaningladyph.com
          </a>
        </p>
      </div>
    </div>
  )
}
