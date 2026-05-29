'use client'

import { useActionState, useState } from 'react'
import { submitFeedback } from '@/app/actions/feedback'

export default function FeedbackForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(submitFeedback, undefined)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="rating" value={rating} />

      {/* Star rating */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Overall Rating *
        </label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(star)}
              className="text-3xl transition-colors focus:outline-none"
            >
              <span className={(hovered || rating) >= star ? 'text-yellow-400' : 'text-gray-200'}>
                ★
              </span>
            </button>
          ))}
          {rating > 0 && (
            <span className="text-sm text-gray-500 ml-2">
              {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][rating]}
            </span>
          )}
        </div>
      </div>

      {/* Comment */}
      <div>
        <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
          Comments <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="comment"
          name="comment"
          rows={4}
          placeholder="Tell us about your experience with the cleaner..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || rating === 0}
        className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? 'Submitting...' : 'Submit feedback'}
      </button>
    </form>
  )
}
