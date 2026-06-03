'use client'

import { useActionState } from 'react'
import { createAnnouncement } from '@/app/actions/announcements'

export default function AnnouncementCreateForm() {
  const [state, action, pending] = useActionState(createAnnouncement, undefined)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm font-semibold text-gray-700 mb-4">New Announcement</p>
      <form action={action} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
          <input
            name="title"
            type="text"
            required
            placeholder="e.g. Holiday schedule update"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Body <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            name="body"
            rows={3}
            placeholder="Additional details shown below the title..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
            Announcement posted.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Posting...' : 'Post Announcement'}
        </button>
      </form>
    </div>
  )
}
