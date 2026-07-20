'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { searchCustomers } from '@/app/actions/admin'
import { startSupportChat } from '@/app/actions/support'
import { useBasePath } from '@/components/dashboard/base-path-context'

type Customer = { id: string; full_name: string; phone: string | null }

// "New chat" button + dialog: lets an admin start a direct support conversation
// with a chosen customer (searched by name) and send the first message. Sends
// straight to the direct-message thread — no complaint is created.
export default function NewChatButton() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const basePath = useBasePath()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-700 active:scale-95 transition-all shrink-0"
      >
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 4v12M4 10h12" />
        </svg>
        New chat
      </button>

      {open && (
        <NewChatDialog
          onClose={() => setOpen(false)}
          onCreated={(customerId) => {
            setOpen(false)
            router.push(`${basePath}/support/${customerId}`)
          }}
        />
      )}
    </>
  )
}

function NewChatDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (customerId: string) => void
}) {
  const [selected, setSelected] = useState<Customer | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [existing, setExisting] = useState<{ customerId: string; archived: boolean } | null>(null)
  const [pending, startTransition] = useTransition()

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  function handleSearch(value: string) {
    setQuery(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (value.trim().length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true)
      const data = await searchCustomers(value)
      setResults(data)
      setShowDropdown(data.length > 0)
      setIsSearching(false)
    }, 300)
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function submit() {
    setError(null)
    setExisting(null)
    if (!selected) { setError('Please select a customer.'); return }
    if (!message.trim()) { setError('Please enter a message.'); return }

    const fd = new FormData()
    fd.set('customer_id', selected.id)
    fd.set('message', message.trim())

    startTransition(async () => {
      const res = await startSupportChat(fd)
      if (res?.error) {
        setError(res.error)
        if (res.existingCustomerId) setExisting({ customerId: res.existingCustomerId, archived: !!res.existingArchived })
      } else if (res?.customerId) {
        onCreated(res.customerId)
      }
    })
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={() => !pending && onClose()}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">New chat</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Customer */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Customer</label>
          {selected ? (
            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3.5 py-2.5 border border-gray-200">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{selected.full_name}</p>
                {selected.phone && <p className="text-xs text-gray-500">{selected.phone}</p>}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs text-pink-600 hover:text-pink-700 font-medium shrink-0 ml-2"
              >
                Change
              </button>
            </div>
          ) : (
            <div ref={dropdownRef} className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by customer name..."
                className={inputClass}
                autoFocus
              />
              {isSearching && (
                <div className="absolute right-3 top-2.5">
                  <div className="w-4 h-4 border-2 border-pink-300 border-t-pink-600 rounded-full animate-spin" />
                </div>
              )}
              {showDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto animate-dropdown-in">
                  {results.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelected(c); setShowDropdown(false); setQuery(''); setResults([]) }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                      {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                    </button>
                  ))}
                </div>
              )}
              {query.trim().length >= 2 && !isSearching && results.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">No customers found.</p>
              )}
            </div>
          )}
        </div>

        {/* Message */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write the first message to the customer..."
            rows={4}
            className={`${inputClass} resize-none`}
          />
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg space-y-1.5">
            <p>{error}</p>
            {existing && (
              <button
                type="button"
                onClick={() => onCreated(existing.customerId)}
                className="font-semibold underline underline-offset-2 hover:text-red-700"
              >
                {existing.archived ? 'Open archived chat →' : 'Go to existing chat →'}
              </button>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-sm px-4 py-2 rounded-lg font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="text-sm px-4 py-2 rounded-lg font-semibold bg-pink-600 text-white hover:bg-pink-700 active:scale-95 transition-all disabled:opacity-50"
          >
            {pending ? 'Starting…' : 'Start chat'}
          </button>
        </div>
      </div>
    </div>
  )
}
