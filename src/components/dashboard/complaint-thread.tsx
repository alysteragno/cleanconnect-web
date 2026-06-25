'use client'

import { ChatThread } from './chat-thread'
import { sendComplaintMessage } from '@/app/actions/complaints'
import { type ChatMessage } from '@/utils/chat-helpers'

export default function ComplaintThread({
  complaintId,
  initialMessages,
  currentUserId,
  currentUserRole,
  complaintStatus,
}: {
  complaintId: string
  initialMessages: ChatMessage[]
  currentUserId: string
  currentUserRole: string
  complaintStatus: string
}) {
  const isStaff  = ['super_admin', 'branch_manager'].includes(currentUserRole)
  const isClosed = complaintStatus === 'resolved'

  return (
    <ChatThread
      initialMessages={initialMessages}
      currentUserId={currentUserId}
      isStaff={isStaff}
      channelName={`complaint-${complaintId}`}
      subscriptionTable="complaint_messages"
      subscriptionFilter={`complaint_id=eq.${complaintId}`}
      onSend={(msg) => sendComplaintMessage(complaintId, msg)}
      isLocked={isClosed}
      lockedMessage="This complaint has been resolved and closed. Contact us to open a new one."
      emptyStateHint={isStaff ? 'Reply to start the conversation.' : 'Describe your concern below to get started.'}
    />
  )
}
