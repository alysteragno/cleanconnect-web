'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { setComplaintArchived } from '@/app/actions/complaints'
import { useSwipeReveal } from '@/hooks/use-swipe-reveal'
import { useBasePath } from '@/components/dashboard/base-path-context'

// A single row in the complaints list. Owns the archive/restore control so it
// can animate itself out (collapse + fade) the moment the action succeeds,
// instead of waiting for a full page refresh to make it disappear abruptly.
// On touch devices it also supports swiping the row left to reveal the same
// action (there's no hover to rely on there); on mouse/desktop the
// tap-to-reveal icon button still works as before.
export default function ComplaintRow({
  complaintId,
  subject,
  customerName,
  dateLabel,
  statusLabel,
  statusClass,
  archived,
}: {
  complaintId: string
  subject: string
  customerName: string
  dateLabel: string
  statusLabel: string
  statusClass: string
  archived: boolean
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const { dragX, dragging, revealWidth, close, handlers } = useSwipeReveal()
  const basePath = useBasePath()

  function run(nextArchived: boolean) {
    setError(null)
    startTransition(async () => {
      const res = await setComplaintArchived(complaintId, nextArchived)
      if (res?.error) { setError(res.error); return }
      setConfirmOpen(false)
      setExiting(true)
      // Let the collapse animation play before the list refreshes under it.
      setTimeout(() => router.refresh(), 220)
    })
  }

  return (
    <div className="relative overflow-hidden">
      {/* Revealed by swiping the row left on touch devices. */}
      <button
        type="button"
        tabIndex={-1}
        onClick={() => { close(); if (archived) run(false); else setConfirmOpen(true) }}
        aria-hidden="true"
        className={`absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-0.5 text-white text-[10px] font-semibold ${
          archived ? 'bg-gray-500' : 'bg-red-500'
        }`}
        style={{ width: revealWidth }}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          {archived
            ? <path d="M10 5V2L6 6l4 4V7a4 4 0 11-4 4" />
            : <>
                <rect x="1" y="3" width="18" height="4" rx="0.5" />
                <path d="M2.5 7v9.5a1 1 0 001 1h13a1 1 0 001-1V7" />
                <line x1="8" y1="10.5" x2="12" y2="10.5" />
              </>}
        </svg>
        {archived ? 'Restore' : 'Archive'}
      </button>

      <div
        {...handlers}
        style={{ transform: `translateX(${dragX}px)`, transition: dragging ? 'none' : 'transform 0.2s ease-out' }}
        className={`group relative flex items-center gap-3 px-5 py-4 bg-white hover:bg-gray-50 transition-colors ${
          exiting ? 'animate-row-collapse pointer-events-none' : ''
        }`}
      >
        <Link href={`${basePath}/complaints/${complaintId}`} aria-label={subject} className="absolute inset-0" />

        <div className="flex-1 min-w-0 pointer-events-none">
          <p className="text-sm font-medium text-gray-900 truncate">{subject}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{customerName} · {dateLabel}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 pointer-events-none ${statusClass}`}>
          {statusLabel}
        </span>

        <div className="relative z-10 shrink-0">
          {archived ? (
            <button
              type="button"
              onClick={() => run(false)}
              disabled={pending}
              title="Restore complaint"
              aria-label="Restore complaint"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 active:scale-90 transition-all disabled:opacity-50 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 5V2L6 6l4 4V7a4 4 0 11-4 4" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              title="Archive complaint"
              aria-label="Archive complaint"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 active:scale-90 transition-all opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="18" height="4" rx="0.5" />
                <path d="M2.5 7v9.5a1 1 0 001 1h13a1 1 0 001-1V7" />
                <line x1="8" y1="10.5" x2="12" y2="10.5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Rendered outside the translating row above — an inline `transform`
          (even translateX(0)) makes its element the containing block for
          `position: fixed` descendants, which would break this overlay. */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => !pending && setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-gray-900">Archive this complaint?</h2>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              <span className="font-medium text-gray-700">“{subject}”</span> will move out of the
              active list to keep things tidy. No data is deleted — the full conversation is
              preserved and you can restore it anytime from the
              <span className="font-medium text-gray-600"> Archived</span> tab.
            </p>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg mt-4">{error}</p>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
                className="text-xs px-3.5 py-2 rounded-lg font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => run(true)}
                disabled={pending}
                className="text-xs px-3.5 py-2 rounded-lg font-semibold bg-gray-900 text-white hover:bg-gray-700 active:scale-95 transition-all disabled:opacity-50"
              >
                {pending ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
