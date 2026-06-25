'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { type ChatMessage, formatMsgTime, formatDayLabel, groupMessagesByDay } from '@/utils/chat-helpers'

interface Props {
  initialMessages: ChatMessage[]
  currentUserId: string
  isStaff: boolean
  channelName: string
  subscriptionTable: string
  subscriptionFilter: string
  onSend: (message: string) => Promise<{ error?: string } | undefined>
  isLocked?: boolean
  lockedMessage?: string
  emptyStateHint?: string
}

export function ChatThread({
  initialMessages,
  currentUserId,
  isStaff,
  channelName,
  subscriptionTable,
  subscriptionFilter,
  onSend,
  isLocked = false,
  lockedMessage = 'This conversation is closed.',
  emptyStateHint,
}: Props) {
  const [messages, setMessages]   = useState(initialMessages)
  const [text, setText]           = useState('')
  const [pending, setPending]     = useState(false)
  const [error, setError]         = useState('')
  const bottomRef                 = useRef<HTMLDivElement>(null)
  const textareaRef               = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: subscriptionTable, filter: subscriptionFilter },
        async (payload) => {
          const { data } = await supabase
            .from(subscriptionTable)
            .select('id, message, created_at, sender_id')
            .eq('id', payload.new.id)
            .single()
          if (data) setMessages((prev) => [...prev, data as unknown as ChatMessage])
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [channelName, subscriptionTable, subscriptionFilter])

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    setPending(true)
    setError('')
    const result = await onSend(trimmed)
    if (result?.error) {
      setError(result.error)
    } else {
      setText('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    }
    setPending(false)
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  const grouped       = groupMessagesByDay(messages)
  const defaultHint   = isStaff ? 'Reply to start the conversation.' : 'Type a message to get started.'

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400 text-center">
              No messages yet.<br />
              <span className="text-xs">{emptyStateHint ?? defaultHint}</span>
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {grouped.map(({ day, msgs }) => (
              <div key={day}>
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-medium px-1">{formatDayLabel(msgs[0].created_at)}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {msgs.map((msg, i) => {
                  const isOwn           = msg.sender_id === currentUserId
                  const senderLabel     = isStaff
                    ? (isOwn ? null : msg.profiles?.full_name ?? 'Customer')
                    : (isOwn ? null : 'Support')
                  const isFirstInGroup  = i === 0 || msgs[i - 1].sender_id !== msg.sender_id
                  const isLastInGroup   = i === msgs.length - 1 || msgs[i + 1].sender_id !== msg.sender_id

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}
                    >
                      <div className={`max-w-[72%] sm:max-w-[60%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                        {isFirstInGroup && !isOwn && senderLabel && (
                          <p className="text-xs text-gray-400 font-medium px-1 mb-0.5">{senderLabel}</p>
                        )}
                        <div className={`px-3.5 py-2 text-sm leading-relaxed break-words ${
                          isOwn
                            ? `bg-pink-600 text-white ${isFirstInGroup ? 'rounded-t-2xl' : 'rounded-2xl'} rounded-bl-2xl rounded-br-sm`
                            : `bg-white text-gray-900 border border-gray-100 shadow-sm ${isFirstInGroup ? 'rounded-t-2xl' : 'rounded-2xl'} rounded-br-2xl rounded-bl-sm`
                        }`}>
                          {msg.message}
                        </div>
                        {isLastInGroup && (
                          <p className="text-xs text-gray-400 px-1 mt-0.5">{formatMsgTime(msg.created_at)}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 bg-white border-t border-gray-200 px-4 py-3">
        {isLocked ? (
          <p className="text-sm text-center text-gray-400 py-1">{lockedMessage}</p>
        ) : (
          <div className="space-y-1.5">
            {error && <p className="text-xs text-red-500 px-1">{error}</p>}
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onInput={handleInput}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none bg-gray-50 leading-snug transition-shadow"
                style={{ minHeight: '42px', maxHeight: '120px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                }}
              />
              <button
                onClick={handleSend}
                disabled={pending || !text.trim()}
                className="w-10 h-10 bg-pink-600 text-white rounded-2xl flex items-center justify-center hover:bg-pink-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                aria-label="Send"
              >
                <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.5 2.5L17.5 10 2.5 17.5V12.5l10-2.5-10-2.5V2.5z" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-300 text-right pr-1">Enter to send · Shift+Enter for new line</p>
          </div>
        )}
      </div>

    </div>
  )
}
