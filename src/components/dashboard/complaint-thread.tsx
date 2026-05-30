'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { sendComplaintMessage } from '@/app/actions/complaints'

type Message = {
  id: string
  message: string
  created_at: string
  sender_id: string
  profiles: { full_name: string; role: string } | null
}

export default function ComplaintThread({
  complaintId,
  initialMessages,
  currentUserId,
  currentUserRole,
  complaintStatus,
}: {
  complaintId: string
  initialMessages: Message[]
  currentUserId: string
  currentUserRole: string
  complaintStatus: string
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`complaint-${complaintId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'complaint_messages', filter: `complaint_id=eq.${complaintId}` },
        async (payload) => {
          const { data } = await supabase
            .from('complaint_messages')
            .select('id, message, created_at, sender_id, profiles (full_name, role)')
            .eq('id', payload.new.id)
            .single()
          if (data) setMessages((prev) => [...prev, data as unknown as Message])
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [complaintId])

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    setPending(true)
    setError('')
    const result = await sendComplaintMessage(complaintId, trimmed)
    if (result?.error) setError(result.error)
    else setText('')
    setPending(false)
  }

  const isStaff = ['super_admin', 'branch_manager'].includes(currentUserRole)
  const isClosed = complaintStatus === 'resolved'

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col" style={{ minHeight: '400px' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No messages yet.</p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.sender_id === currentUserId
          const senderLabel = isOwn
            ? 'You'
            : isStaff
            ? msg.profiles?.full_name ?? 'Customer'
            : 'Support'

          return (
            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
                <p className="text-xs text-gray-400">{senderLabel}</p>
                <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  isOwn
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}>
                  {msg.message}
                </div>
                <p className="text-xs text-gray-300">
                  {new Date(msg.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-4">
        {isClosed ? (
          <p className="text-sm text-center text-gray-400">This complaint is resolved and closed.</p>
        ) : (
          <>
            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                }}
              />
              <button
                onClick={handleSend}
                disabled={pending || !text.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors self-end"
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
