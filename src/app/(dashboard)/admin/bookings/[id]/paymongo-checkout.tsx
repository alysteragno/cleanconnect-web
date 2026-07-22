'use client'

import { useState } from 'react'
import { PAYMENT_METHOD_META } from '@/components/payment-icons'

// Read-only PayMongo payment detail for the admin booking page. The admin
// never collects payment here — the customer pays on their own through the
// mobile app (which has its own inline QR Ph flow via
// /api/paymongo/qrph-intent). This component's only job is to show what
// PayMongo actually recorded once that settles: amount charged, fee, net
// received, method used, timestamps, and IDs. Before payment, it's just a
// status note — no button, no link, nothing for the admin to act on here.
// The "Mark as Paid (manual override)" button in PaymentVerificationCard
// remains the only admin-side action, for reconciling a payment confirmed
// outside this flow.

const SOURCE_LABELS: Record<string, string> = {
  qrph: 'QR Ph',
  gcash: 'GCash',
  paymaya: 'Maya',
  card: 'Card',
  grab_pay: 'GrabPay',
  billease: 'Billease',
  dob: 'Online Banking',
  dob_ubp: 'UnionBank Online',
}

function formatPeso(n: number) {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Manila',
  })
}

export type PaymongoDetail = {
  paymentId: string | null
  paymentIntentId: string | null
  checkoutId: string | null
  amount: number | null
  fee: number | null
  netAmount: number | null
  currency: string | null
  sourceType: string | null
  status: string | null
  paidAt: string | null
}

export default function PayMongoCheckout({
  paymentMethod,
  paymentStatus,
  detail,
}: {
  paymentMethod: string
  paymentStatus: string
  detail: PaymongoDetail | null
}) {
  const [copied, setCopied] = useState<string | null>(null)

  // Non-digital methods (cash, bank check) never go through PayMongo at all.
  const isDigital = PAYMENT_METHOD_META[paymentMethod]?.isDigital ?? false
  if (!isDigital) return null

  const isPaid = paymentStatus === 'paid'

  function copyId(id: string) {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  if (!isPaid) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">PayMongo</p>
        <div className="flex items-start gap-2.5 px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl">
          <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-gray-500 leading-snug">
            Awaiting payment — the customer pays through the mobile app. This updates to <span className="font-semibold text-gray-700">Paid</span> automatically once PayMongo confirms it.
          </p>
        </div>
      </div>
    )
  }

  // ── Paid — full settlement detail ──────────────────────────────────────
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
        PayMongo
      </p>
      <div className="flex items-start gap-2.5 px-3.5 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
        <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-emerald-700">Paid via PayMongo</p>
          {detail?.paidAt && (
            <p className="text-[11px] text-emerald-600/80 mt-0.5">{formatTimestamp(detail.paidAt)}</p>
          )}
        </div>
      </div>

      {detail && (
        <dl className="text-xs divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
          {detail.amount != null && (
            <Row label="Amount Charged" value={formatPeso(detail.amount)} strong />
          )}
          {detail.sourceType && (
            <Row label="Method Used" value={SOURCE_LABELS[detail.sourceType] ?? detail.sourceType} />
          )}
          {detail.fee != null && (
            <Row label="PayMongo Fee" value={`− ${formatPeso(detail.fee)}`} />
          )}
          {detail.netAmount != null && (
            <Row label="Net Received" value={formatPeso(detail.netAmount)} strong />
          )}
          {detail.status && (
            <Row label="Status" value={detail.status} capitalize />
          )}
          {detail.currency && (
            <Row label="Currency" value={detail.currency} />
          )}
        </dl>
      )}

      {(detail?.paymentId || detail?.paymentIntentId) && (
        <div className="space-y-1.5">
          {detail.paymentId && (
            <IdRow label="Payment ID" id={detail.paymentId} onCopy={copyId} copied={copied === detail.paymentId} />
          )}
          {detail.paymentIntentId && (
            <IdRow label="Payment Intent" id={detail.paymentIntentId} onCopy={copyId} copied={copied === detail.paymentIntentId} />
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, strong, capitalize }: { label: string; value: string; strong?: boolean; capitalize?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2 bg-white">
      <span className="text-gray-500">{label}</span>
      <span className={`${strong ? 'font-semibold text-gray-900' : 'text-gray-700'} ${capitalize ? 'capitalize' : ''} tabular-nums`}>
        {value}
      </span>
    </div>
  )
}

function IdRow({ label, id, onCopy, copied }: { label: string; id: string; onCopy: (id: string) => void; copied: boolean }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-[11px] text-gray-700 font-mono break-all leading-snug">{id}</p>
      </div>
      <button
        type="button"
        onClick={() => onCopy(id)}
        className={`text-[11px] font-semibold shrink-0 px-2 py-1 rounded-lg transition-all ${
          copied ? 'bg-emerald-100 text-emerald-700' : 'text-pink-600 hover:bg-pink-50'
        }`}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
