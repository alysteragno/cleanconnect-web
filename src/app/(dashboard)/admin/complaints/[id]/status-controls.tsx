'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateComplaintStatus } from '@/app/actions/complaints'

const STATUS_OPTIONS = [
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved' },
]
const STATUS_STYLES: Record<string, string> = {
  open:        'bg-yellow-50 text-yellow-700 border-yellow-200',
  in_progress: 'bg-pink-50 text-pink-700 border-pink-200',
  resolved:    'bg-green-50 text-green-700 border-green-200',
}

// Status switcher for a complaint. "Resolved" stays disabled until the customer
// has received a reply (hasStaffReply), and any server-side guard rejection is
// surfaced inline rather than silently ignored.
export default function ComplaintStatusControls({
  complaintId,
  currentStatus,
  hasStaffReply,
}: {
  complaintId: string
  currentStatus: string
  hasStaffReply: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function setStatus(status: string) {
    setError(null)
    startTransition(async () => {
      const res = await updateComplaintStatus(complaintId, status)
      if (res?.error) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="relative flex items-center gap-1">
      {STATUS_OPTIONS.map((opt) => {
        const isActive = currentStatus === opt.value
        const blockResolve = opt.value === 'resolved' && !hasStaffReply
        const disabled = isActive || pending || blockResolve
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatus(opt.value)}
            disabled={disabled}
            title={blockResolve ? 'Reply to the customer before resolving' : undefined}
            className={`text-xs px-2.5 py-1.5 rounded-lg font-medium border transition-colors whitespace-nowrap ${
              isActive
                ? STATUS_STYLES[opt.value]
                : blockResolve
                  ? 'bg-white text-gray-300 border-gray-100 cursor-not-allowed'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
            } ${isActive ? 'disabled:cursor-default' : ''}`}
          >
            {opt.label}
          </button>
        )
      })}

      {error && (
        <div className="absolute top-full right-0 mt-1.5 z-20 w-64 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg shadow-sm">
          {error}
        </div>
      )}
    </div>
  )
}
