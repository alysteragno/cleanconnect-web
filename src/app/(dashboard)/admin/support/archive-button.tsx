'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setSupportConversationArchived } from '@/app/actions/support'

// Archive / restore control for a support conversation, shown in the thread
// header. Archiving asks for confirmation (it removes the conversation from
// the active list) but never deletes any data — the thread stays fully
// readable and can be restored at any time.
export default function ArchiveSupportButton({
  customerId,
  archived,
}: {
  customerId: string
  archived: boolean
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function run(nextArchived: boolean) {
    setError(null)
    startTransition(async () => {
      const res = await setSupportConversationArchived(customerId, nextArchived)
      if (res?.error) {
        setError(res.error)
      } else {
        setConfirmOpen(false)
        router.refresh()
      }
    })
  }

  // Restore is non-destructive — no confirmation needed.
  if (archived) {
    return (
      <button
        type="button"
        onClick={() => run(false)}
        disabled={pending}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 5V2L6 6l4 4V7a4 4 0 11-4 4" />
        </svg>
        <span className="hidden sm:inline">{pending ? 'Restoring…' : 'Restore'}</span>
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700 active:scale-95 transition-all whitespace-nowrap"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="18" height="4" rx="0.5" />
          <path d="M2.5 7v9.5a1 1 0 001 1h13a1 1 0 001-1V7" />
          <line x1="8" y1="10.5" x2="12" y2="10.5" />
        </svg>
        <span className="hidden sm:inline">Archive</span>
      </button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => !pending && setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                  <rect x="1" y="3" width="18" height="4" rx="0.5" />
                  <path d="M2.5 7v9.5a1 1 0 001 1h13a1 1 0 001-1V7" />
                  <line x1="8" y1="10.5" x2="12" y2="10.5" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900">Archive this conversation?</h2>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  It will be moved out of the active list to keep things tidy. No data is deleted —
                  the full conversation is preserved and you can restore it anytime from the
                  <span className="font-medium text-gray-600"> Archived</span> tab.
                </p>
              </div>
            </div>

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
    </>
  )
}
