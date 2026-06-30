'use client'

import { useState, useTransition } from 'react'
import { updatePaymentStatus } from '@/app/actions/admin'
import { PAYMENT_METHOD_META } from '@/components/payment-icons'

const STATUS_META: Record<string, { pill: string; dot: string; label: string }> = {
  unpaid:   { pill: 'bg-red-50 text-red-700 border-red-200',               dot: 'bg-red-500',     label: 'Unpaid' },
  paid:     { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',   dot: 'bg-emerald-500', label: 'Paid'     },
  refunded: { pill: 'bg-blue-50 text-blue-700 border-blue-200',            dot: 'bg-blue-500',    label: 'Refunded' },
  partial:  { pill: 'bg-amber-50 text-amber-700 border-amber-200',         dot: 'bg-amber-400',   label: 'Partial'  },
}

export default function PaymentVerificationCard({
  bookingId,
  paymentMethod,
  bankUsed,
  paymentStatus,
  paymentReference,
  paymentProofUrl,
}: {
  bookingId: string
  paymentMethod: string
  bankUsed: string | null
  paymentStatus: string
  paymentReference: string | null
  paymentProofUrl: string | null
}) {
  const [copied, setCopied] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const meta = PAYMENT_METHOD_META[paymentMethod]
  const isDigital = meta?.isDigital ?? false
  const isCash = paymentMethod === 'cash'
  const isPaid = paymentStatus === 'paid'
  const statusStyle = STATUS_META[paymentStatus] ?? STATUS_META.unpaid
  const statusLabel = paymentStatus === 'unpaid'
    ? isCash ? 'Awaiting Cash Payment' : 'Pending Confirmation'
    : statusStyle.label

  function handleCopy() {
    if (!paymentReference) return
    navigator.clipboard.writeText(paymentReference).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleMarkAsPaid() {
    setError(null)
    setSuccess(null)
    const fd = new FormData()
    fd.set('booking_id', bookingId)
    fd.set('payment_status', 'paid')
    startTransition(async () => {
      const result = await updatePaymentStatus(undefined, fd)
      if (result?.error) setError(result.error)
      else if (result?.success) setSuccess(result.success)
    })
  }

  return (
    <>
      <div className="space-y-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
          Payment Method
        </p>

        {/* Method + status row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Logo display */}
            {paymentMethod === 'gcash' && (
              <div className="flex items-center justify-center h-11 px-3 rounded-xl border border-gray-100 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/GCash_logo.svg" alt="GCash" className="h-6 w-auto object-contain" />
              </div>
            )}
            {paymentMethod === 'maya' && (
              <div className="flex items-center justify-center h-11 px-3 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/maya_logo.jpeg" alt="Maya" className="h-7 w-auto object-contain rounded" />
              </div>
            )}
            {paymentMethod === 'bank_transfer' && (
              <div className="w-11 h-11 rounded-xl bg-gray-800 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
              </div>
            )}
            {paymentMethod === 'bank_check' && (
              <div className="w-11 h-11 rounded-xl bg-blue-800 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
            )}
            {paymentMethod === 'cash' && (
              <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            )}
            <div>
              <span className="text-sm font-semibold text-gray-900">
                {meta?.label ?? paymentMethod.replace('_', ' ')}
              </span>
              {paymentMethod === 'bank_transfer' && bankUsed && (
                <p className="text-xs text-gray-500 mt-0.5">{bankUsed}</p>
              )}
            </div>
          </div>

          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border shrink-0 ${statusStyle.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
            {statusLabel}
          </span>
        </div>

        {/* Digital payment details */}
        {isDigital && (
          <div className="space-y-3.5 pt-0.5">
            {paymentReference && (
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Reference No.</p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5">
                  <span className="text-sm text-gray-900 font-mono flex-1 break-all leading-snug">
                    {paymentReference}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`text-xs font-semibold shrink-0 px-2.5 py-1 rounded-lg transition-all ${
                      copied
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'text-pink-600 hover:bg-pink-50'
                    }`}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {paymentProofUrl && (
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Proof of Payment</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="w-20 h-20 rounded-xl overflow-hidden border border-gray-200 hover:border-pink-300 hover:shadow-md transition-all shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={paymentProofUrl} alt="Payment proof thumbnail" className="w-full h-full object-cover" />
                  </button>
                  <a
                    href={paymentProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-pink-600 hover:text-pink-800 underline underline-offset-2 transition-colors"
                  >
                    Open full image
                  </a>
                </div>
              </div>
            )}

            {!paymentReference && !paymentProofUrl && (
              <p className="text-xs text-gray-400 italic">No reference number or proof uploaded yet.</p>
            )}
          </div>
        )}

        {/* Mark as paid */}
        {!isPaid && isCash && (
          <div className="flex items-start gap-2.5 px-3.5 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-amber-700 leading-snug">
              <span className="font-semibold">Pending cash collection.</span> The cleaner confirms payment via the mobile app.
            </p>
          </div>
        )}
        {!isPaid && !isCash && (
          <button
            type="button"
            onClick={handleMarkAsPaid}
            disabled={isPending}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Updating...' : 'Mark as Paid'}
          </button>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
        )}
        {success && (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">{success}</p>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && paymentProofUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute -top-10 right-0 flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={paymentProofUrl}
              alt="Payment proof"
              className="w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
            />
            <a
              href={paymentProofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-3 text-center text-sm text-white/70 hover:text-white underline underline-offset-2 transition-colors"
            >
              Open full image
            </a>
          </div>
        </div>
      )}
    </>
  )
}
