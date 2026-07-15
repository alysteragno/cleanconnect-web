'use client'

import { useState } from 'react'

// PayMongo checkout link management for a booking. Digital (non-cash) bookings
// are collected through a hosted PayMongo Checkout Session; the webhook flips the
// status to Paid automatically once payment clears. The manual "Mark as Paid" in
// PaymentVerificationCard remains as a fallback override.
export default function PayMongoCheckout({
  bookingId,
  paymentMethod,
  paymentStatus,
  checkoutUrl,
  paymentId,
}: {
  bookingId: string
  paymentMethod: string
  paymentStatus: string
  checkoutUrl: string | null
  paymentId: string | null
}) {
  const [url, setUrl] = useState<string | null>(checkoutUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Cash is collected on-site — no online checkout.
  if (paymentMethod === 'cash') return null

  const isPaid = paymentStatus === 'paid'

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/paymongo/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create checkout link.')
      } else {
        setUrl(data.checkout_url)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function copy() {
    if (!url) return
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (isPaid) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
          PayMongo
        </p>
        <div className="flex items-start gap-2.5 px-3.5 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-700">Paid via PayMongo</p>
            {paymentId && (
              <p className="text-[11px] text-emerald-600/80 font-mono mt-0.5 break-all">{paymentId}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
        PayMongo Checkout
      </p>

      {url ? (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5">
            <span className="text-xs text-gray-700 font-mono flex-1 break-all leading-snug">
              {url}
            </span>
            <button
              type="button"
              onClick={copy}
              className={`text-xs font-semibold shrink-0 px-2.5 py-1 rounded-lg transition-all ${
                copied ? 'bg-emerald-100 text-emerald-700' : 'text-pink-600 hover:bg-pink-50'
              }`}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-pink-600 text-white rounded-xl text-sm font-semibold hover:bg-pink-700 transition-colors"
          >
            Open checkout page
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <p className="text-[11px] text-gray-400 leading-snug">
            Share this link with the customer. Status updates to <span className="font-semibold">Paid</span> automatically once PayMongo confirms payment.
          </p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Generating…' : 'Generate PayMongo checkout link'}
          </button>
          <p className="text-[11px] text-gray-400 leading-snug">
            Creates a secure hosted QRPh payment page — the customer scans the QR with GCash, Maya, or any bank app.
          </p>
        </>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
      )}
    </div>
  )
}
