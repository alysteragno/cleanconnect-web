'use client'

import { useActionState } from 'react'
import { aiDispatchCleaners } from '@/app/actions/ai-dispatch'

type AIDispatchState =
  | { dispatched: number; reasoning: string[] }
  | { error: string }
  | undefined

export default function AIDispatchButton({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState<AIDispatchState, FormData>(
    aiDispatchCleaners,
    undefined
  )

  const isSuccess = state && 'dispatched' in state
  const isError = state && 'error' in state

  return (
    <div className="space-y-4">
      {!isSuccess && (
        <form action={action}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <button type="submit" disabled={pending}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm">
            {pending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                AI is evaluating cleaners...
              </span>
            ) : '🤖 Run AI Dispatch'}
          </button>
        </form>
      )}

      {isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm font-semibold text-red-700 mb-1">AI Dispatch Failed</p>
          <p className="text-sm text-red-600">{state.error}</p>
          <form action={action} className="mt-3">
            <input type="hidden" name="booking_id" value={bookingId} />
            <button type="submit" className="text-xs text-red-600 underline">Try again</button>
          </form>
        </div>
      )}

      {isSuccess && (
        <div className="space-y-3">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🤖</span>
              <p className="text-sm font-semibold text-blue-900">AI Dispatch Complete</p>
              <span className="ml-auto text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-semibold">
                {state.dispatched} offer{state.dispatched !== 1 ? 's' : ''} sent
              </span>
            </div>
            <div className="space-y-1.5">
              {state.reasoning.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-xs text-blue-800 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>
          {state.dispatched === 0 && (
            <p className="text-sm text-gray-500 text-center">No eligible cleaners found. Use manual dispatch below.</p>
          )}
          <form action={action}>
            <input type="hidden" name="booking_id" value={bookingId} />
            <button type="submit" disabled={pending} className="w-full text-xs text-blue-600 hover:underline disabled:opacity-50">
              Re-run AI Dispatch
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
