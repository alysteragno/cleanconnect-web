'use client'

import { useActionState } from 'react'
import dynamic from 'next/dynamic'
import { previewAIDispatch, confirmAIDispatch, type PreviewState, type ConfirmState } from '@/app/actions/ai-dispatch'
import type { RankedCleaner } from '@/lib/ai-assignment'

const DispatchMap = dynamic(() => import('./dispatch-map'), { ssr: false })

function NetworkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="3.5" r="1.5" />
      <circle cx="3.5" cy="14.5" r="1.5" />
      <circle cx="16.5" cy="14.5" r="1.5" />
      <path d="M10 5L4.2 13.2M10 5L15.8 13.2M5 14.5h10" strokeDasharray="2.5 2" />
    </svg>
  )
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.54-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
    </svg>
  )
}

// ── Preview panel ─────────────────────────────────────────────────────────────

function PreviewPanel({
  ranked,
  reasoning,
  bookingId,
  serviceDate,
  bookingLat,
  bookingLng,
  onDiscard,
}: {
  ranked: RankedCleaner[]
  reasoning: string[]
  bookingId: string
  serviceDate: string
  bookingLat: number | null
  bookingLng: number | null
  onDiscard: () => void
}) {
  const formattedDate = new Date(serviceDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  const [confirmState, confirmAction, confirmPending] = useActionState<ConfirmState, FormData>(
    confirmAIDispatch,
    undefined
  )

  const toDispatch = ranked.filter((c) => c.dispatched)
  const skipped    = ranked.filter((c) => !c.dispatched)
  const topCleaner = toDispatch[0] ?? null

  if (confirmState && 'dispatched' in confirmState) {
    return <SuccessPanel dispatched={confirmState.dispatched} reasoning={reasoning} onRerun={onDiscard} />
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <NetworkIcon className="w-4 h-4 text-gray-500 shrink-0" />
        <p className="text-sm font-semibold text-gray-900">AI Recommendation</p>
        <span className="ml-auto text-[11px] bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full font-semibold shrink-0">
          {toDispatch.length} cleaner{toDispatch.length !== 1 ? 's' : ''} proposed
        </span>
      </div>

      {/* Proposed cleaners */}
      {toDispatch.length > 0 ? (
        <div className="space-y-2">
          {toDispatch.map((c) => (
            <div
              key={c.cleanerId}
              className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl"
            >
              <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-700 text-xs font-bold flex items-center justify-center shrink-0 select-none">
                {c.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{c.fullName}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {c.avgRating != null && (
                    <span className="flex items-center gap-0.5 text-[11px] text-amber-600 font-medium">
                      <StarIcon className="w-3 h-3" />
                      {c.avgRating}
                    </span>
                  )}
                  <span className="text-[11px] text-gray-400">
                    {c.workloadScore} job{c.workloadScore !== 1 ? 's' : ''} on {formattedDate}
                  </span>
                  {c.distanceKm != null && (
                    <span className="text-[11px] text-gray-400">
                      · {c.distanceKm.toFixed(1)} km away
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[11px] font-bold text-gray-400">#{c.rank}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 py-1">
          No eligible cleaners found. Adjust filters or assign manually.
        </p>
      )}

      {/* Skipped cleaners (collapsed hint) */}
      {skipped.length > 0 && (
        <p className="text-[11px] text-gray-400">
          +{skipped.length} other cleaner{skipped.length !== 1 ? 's' : ''} evaluated but not selected (ranked lower).
        </p>
      )}

      {/* Proximity map */}
      {bookingLat != null && bookingLng != null && (
        <DispatchMap
          bookingLat={bookingLat}
          bookingLng={bookingLng}
          departureLat={topCleaner?.departureLat ?? null}
          departureLng={topCleaner?.departureLng ?? null}
          departureSource={topCleaner?.departureSource ?? null}
        />
      )}

      {/* Reasoning */}
      <details className="group">
        <summary className="text-[11px] text-gray-400 cursor-pointer hover:text-gray-600 transition-colors list-none flex items-center gap-1 select-none">
          <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          View reasoning
        </summary>
        <ol className="mt-2 space-y-1.5 pl-1">
          {reasoning.map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="min-w-[1.1rem] h-4 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-[9px] font-bold mt-0.5 shrink-0">
                {i + 1}
              </span>
              <p className="text-[11px] text-gray-500 leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </details>

      {/* Error from confirm */}
      {confirmState && 'error' in confirmState && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          {confirmState.error}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onDiscard}
          disabled={confirmPending}
          className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:border-gray-400 hover:text-gray-900 hover:shadow-sm active:bg-gray-100 disabled:opacity-40 transition-all duration-150"
        >
          Discard
        </button>

        {toDispatch.length > 0 && (
          <form action={confirmAction} className="flex-[2]">
            <input type="hidden" name="booking_id" value={bookingId} />
            {toDispatch.map((c) => (
              <input key={c.cleanerId} type="hidden" name="cleaner_ids" value={c.cleanerId} />
            ))}
            <button
              type="submit"
              disabled={confirmPending}
              className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50 transition-all duration-150 flex items-center justify-center gap-2"
            >
              {confirmPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                  Assigning...
                </>
              ) : (
                `Confirm & Assign ${toDispatch.length} Cleaner${toDispatch.length !== 1 ? 's' : ''}`
              )}
            </button>
          </form>
        )}
      </div>

    </div>
  )
}

// ── Success panel ─────────────────────────────────────────────────────────────

function SuccessPanel({
  dispatched,
  reasoning,
  onRerun,
}: {
  dispatched: number
  reasoning: string[]
  onRerun: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <div className="flex items-center gap-2 mb-3.5">
          <NetworkIcon className="w-4 h-4 text-gray-600 shrink-0" />
          <p className="text-sm font-semibold text-gray-900">Dispatch Complete</p>
          <span className="ml-auto text-[11px] bg-gray-900 text-white px-2.5 py-0.5 rounded-full font-semibold shrink-0">
            {dispatched} cleaner{dispatched !== 1 ? 's' : ''} assigned
          </span>
        </div>
        <ol className="space-y-2">
          {reasoning.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="min-w-[1.25rem] h-5 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">
                {i + 1}
              </span>
              <p className="text-xs text-gray-600 leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </div>
      {dispatched === 0 && (
        <p className="text-xs text-gray-400 text-center leading-relaxed">
          No eligible cleaners found. Use manual dispatch or force assign below.
        </p>
      )}
      <button
        type="button"
        onClick={onRerun}
        className="w-full text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
      >
        Re-run AI Dispatch
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AIDispatchButton({ bookingId, serviceDate, disabled = false }: { bookingId: string; serviceDate: string; disabled?: boolean }) {
  const [previewState, previewAction, previewPending] = useActionState<PreviewState, FormData>(
    previewAIDispatch,
    undefined
  )

  const hasPreview = previewState && 'ranked' in previewState
  const hasError   = previewState && 'error' in previewState

  function handleDiscard() {
    // Reset to idle by reloading — useActionState has no built-in reset,
    // so we trigger a re-render by navigating to the same page.
    window.location.reload()
  }

  // Show preview confirmation panel
  if (hasPreview) {
    return (
      <PreviewPanel
        ranked={previewState.ranked}
        reasoning={previewState.reasoning}
        bookingId={bookingId}
        serviceDate={serviceDate}
        bookingLat={previewState.bookingLat}
        bookingLng={previewState.bookingLng}
        onDiscard={handleDiscard}
      />
    )
  }

  // Idle / error state — show the trigger button
  return (
    <div className="space-y-3">
      <form action={previewAction}>
        <input type="hidden" name="booking_id" value={bookingId} />
        <button
          type="submit"
          disabled={previewPending || disabled}
          className="w-full py-3 px-4 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center gap-2.5"
        >
          {previewPending ? (
            <>
              <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
              Evaluating cleaners...
            </>
          ) : (
            <>
              <NetworkIcon className="w-4 h-4" />
              Run AI Dispatch
            </>
          )}
        </button>
      </form>

      {hasError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm font-semibold text-red-700 mb-1">Evaluation Failed</p>
          <p className="text-xs text-red-600">{previewState.error}</p>
        </div>
      )}
    </div>
  )
}
