'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { markAllNotificationsRead, markNotificationRead } from '@/app/actions/notifications'

type Notification = {
  id: string
  title: string
  body: string
  type: string
  booking_id: string | null
  complaint_id: string | null
  customer_id: string | null
  is_read: boolean
  created_at: string
}

type Announcement = {
  id: string
  title: string
  body: string | null
  created_at: string
  poster_name: string
}

function getHref(n: Notification, role: string, basePath: string): string {
  if (n.customer_id && n.type === 'direct_message') {
    if (role === 'super_admin') return `${basePath}/support/${n.customer_id}`
  }
  if (n.booking_id) {
    if (role === 'super_admin') return `${basePath}/bookings/${n.booking_id}`
    if (role === 'cleaner') return `/cleaner/jobs`
    return `/customer/bookings/${n.booking_id}`
  }
  if (n.complaint_id) {
    if (role === 'super_admin') return `${basePath}/complaints/${n.complaint_id}`
    return `/customer/complaints/${n.complaint_id}`
  }
  return '#'
}

export default function NotificationBell({
  userId,
  role,
  basePath = '/admin',
  initialNotifications,
  initialAnnouncements = [],
}: {
  userId: string
  role: string
  basePath?: string
  initialNotifications: Notification[]
  initialAnnouncements?: Announcement[]
}) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [announcements] = useState(initialAnnouncements)
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [ringing, setRinging] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  function closeDropdown() {
    setClosing(true)
  }

  const unread = notifications.filter((n) => !n.is_read).length + announcements.length

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('notification-bell')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => setNotifications((prev) => [payload.new as Notification, ...prev])
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    if (!open && !closing) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setClosing(true)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, closing])

  async function handleMarkAll() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await markAllNotificationsRead()
    closeDropdown()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { open ? closeDropdown() : setOpen(true); setRinging(true) }}
        className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Notifications"
      >
        <svg
          className={`w-5 h-5 ${ringing ? 'animate-bell-ring' : ''}`}
          onAnimationEnd={() => setRinging(false)}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {(open || closing) && (
        <div
          className={`fixed left-2 right-2 top-14 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-1 sm:w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden ${closing ? 'animate-dropdown-out' : 'animate-dropdown-in'}`}
          onAnimationEnd={() => { if (closing) { setClosing(false); setOpen(false) } }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {unread > 0 && (
              <button onClick={handleMarkAll} className="text-xs text-pink-600 hover:underline">
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {/* Notifications */}
            <div className="divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No notifications yet.</p>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <Link
                    key={n.id}
                    href={getHref(n, role, basePath)}
                    onClick={() => {
                      if (!n.is_read) {
                        void markNotificationRead(n.id)
                        setNotifications((prev) =>
                          prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
                        )
                      }
                      closeDropdown()
                    }}
                    className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-pink-50/40' : ''}`}
                  >
                    <p className={`text-sm font-medium ${!n.is_read ? 'text-gray-900' : 'text-gray-500'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{n.body}</p>
                    <p className="text-xs text-gray-300 mt-1">
                      {new Date(n.created_at).toLocaleDateString('en-PH', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </Link>
                ))
              )}
            </div>

            {/* Announcements */}
            {announcements.length > 0 && (
              <>
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Announcements</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {announcements.map((a) => (
                    <div key={a.id} className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{a.title}</p>
                      {a.body && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{a.body}</p>}
                      <p className="text-xs text-gray-300 mt-1">
                        {new Date(a.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        <span className="ml-1.5">· <span className="font-medium text-gray-400">{a.poster_name}</span></span>
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
