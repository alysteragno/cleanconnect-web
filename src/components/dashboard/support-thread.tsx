'use client'

import { ChatThread } from './chat-thread'
import { sendSupportMessage } from '@/app/actions/support'
import { type ChatMessage } from '@/utils/chat-helpers'

export default function SupportThread({
  customerId,
  initialMessages,
  currentUserId,
  isStaff,
}: {
  customerId: string
  initialMessages: ChatMessage[]
  currentUserId: string
  isStaff: boolean
}) {
  return (
    <ChatThread
      initialMessages={initialMessages}
      currentUserId={currentUserId}
      isStaff={isStaff}
      channelName={`support-${customerId}`}
      subscriptions={[
        { table: 'admin_messages',  filter: `customer_id=eq.${customerId}` },
        { table: 'direct_messages', filter: `customer_id=eq.${customerId}` },
      ]}
      onSend={(msg) => sendSupportMessage(customerId, msg)}
      emptyStateHint={isStaff ? 'Reply to start the conversation.' : 'Send a message and our team will respond shortly.'}
    />
  )
}
