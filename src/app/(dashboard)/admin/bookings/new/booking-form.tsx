'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { createManualBooking, searchCustomers, createCustomerAccount } from '@/app/actions/admin'

// ── Helpers ────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-1">
      {children}
    </p>
  )
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition'

function Field({
  label, name, required, hint, children, ...rest
}: {
  label: string; name: string; required?: boolean; hint?: string
  type?: string; placeholder?: string; min?: number; max?: number
  step?: string; maxLength?: number; defaultValue?: string
  children?: React.ReactNode
}) {
  if (children) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
          {!required && <span className="text-gray-400 font-normal text-xs ml-1">(optional)</span>}
        </label>
        {children}
        {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      </div>
    )
  }
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        {!required && <span className="text-gray-400 font-normal text-xs ml-1">(optional)</span>}
      </label>
      <input name={name} required={required} className={inputClass} {...rest} />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'gcash',         label: 'GCash' },
  { value: 'maya',          label: 'Maya' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'bank_check',   label: 'Bank Check' },
]

// Services that use per-unit pricing (not area-based sqm pricing)
const UNIT_BASED_SLUGS = new Set([
  'aircon_cleaning', 'aircon_repair',
  'grease_trap_installation', 'carpet_cleaning', 'curtain_dry_cleaning',
])

// ── Component ──────────────────────────────────────────────────────────────

type Service = { id: string; name: string; slug: string; price_from: number }
type Customer = { id: string; full_name: string; phone: string | null }

export default function BookingForm({ services }: { services: Service[] }) {
  const [state, action, pending] = useActionState(createManualBooking, undefined)

  // Customer search state
  const [customerMode, setCustomerMode] = useState<'search' | 'create'>('search')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Create customer state
  const [createPending, startCreateTransition] = useTransition()
  const [createError, setCreateError] = useState<string | null>(null)

  // Service & payment
  const [selectedSlug, setSelectedSlug] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')

  const selectedService = services.find(s => s.slug === selectedSlug)
  const isUnitBased = UNIT_BASED_SLUGS.has(selectedSlug)

  // Debounced search
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

  // Click outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c)
    setShowDropdown(false)
    setQuery('')
    setResults([])
  }

  function handleCreateCustomer(fd: FormData) {
    setCreateError(null)
    startCreateTransition(async () => {
      const result = await createCustomerAccount(fd)
      if (result.error) {
        setCreateError(result.error)
      } else if (result.customer) {
        setSelectedCustomer(result.customer)
        setCustomerMode('search')
      }
    })
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="customer_id" value={selectedCustomer?.id ?? ''} />
      <input type="hidden" name="payment_method" value={paymentMethod} />
      <input type="hidden" name="service_slug" value={selectedSlug} />

      {/* ── Customer ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <SectionLabel>Customer</SectionLabel>

        {selectedCustomer ? (
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
            <div>
              <p className="text-sm font-semibold text-gray-900">{selectedCustomer.full_name}</p>
              {selectedCustomer.phone && (
                <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedCustomer(null)}
              className="text-xs text-pink-600 hover:text-pink-700 font-medium"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            {/* Mode toggle */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setCustomerMode('search')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  customerMode === 'search'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Search existing
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode('create')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  customerMode === 'create'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Create new
              </button>
            </div>

            {customerMode === 'search' ? (
              <div ref={dropdownRef} className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Search by customer name..."
                  className={inputClass}
                />
                {isSearching && (
                  <div className="absolute right-3 top-2.5">
                    <div className="w-4 h-4 border-2 border-pink-300 border-t-pink-600 rounded-full animate-spin" />
                  </div>
                )}

                {showDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden animate-dropdown-in">
                    {results.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                        {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                      </button>
                    ))}
                  </div>
                )}

                {query.trim().length >= 2 && !isSearching && results.length === 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    No customers found.{' '}
                    <button type="button" onClick={() => setCustomerMode('create')} className="text-pink-600 font-medium hover:text-pink-700">
                      Create a new customer
                    </button>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full name<span className="text-red-400 ml-0.5">*</span></label>
                  <input name="new_full_name" required className={`${inputClass} bg-white`} placeholder="Juan dela Cruz" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email<span className="text-red-400 ml-0.5">*</span></label>
                  <input name="new_email" type="email" required className={`${inputClass} bg-white`} placeholder="customer@email.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone<span className="text-red-400 ml-0.5">*</span></label>
                  <input name="new_phone" type="tel" required maxLength={11} pattern="09[0-9]{9}" className={`${inputClass} bg-white`} placeholder="09XX XXX XXXX" />
                </div>

                {createError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{createError}</p>
                )}

                <button
                  type="button"
                  disabled={createPending}
                  onClick={() => {
                    const form = document.querySelector('form')!
                    const fd = new FormData()
                    fd.set('full_name', (form.querySelector('[name="new_full_name"]') as HTMLInputElement)?.value ?? '')
                    fd.set('email', (form.querySelector('[name="new_email"]') as HTMLInputElement)?.value ?? '')
                    fd.set('phone', (form.querySelector('[name="new_phone"]') as HTMLInputElement)?.value ?? '')
                    handleCreateCustomer(fd)
                  }}
                  className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {createPending ? 'Creating customer...' : 'Create Customer'}
                </button>

                <p className="text-[11px] text-gray-400 text-center">
                  We&apos;ll email the customer a link to set their own password.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Service Details ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <SectionLabel>Service Details</SectionLabel>

        <Field label="Service" name="service_name" required>
          <select
            name="service_name"
            required
            value={selectedService?.name ?? ''}
            onChange={e => {
              const svc = services.find(s => s.name === e.target.value)
              setSelectedSlug(svc?.slug ?? '')
            }}
            className={`${inputClass} bg-white`}
          >
            <option value="" disabled>Select a service...</option>
            {services.length === 0 && (
              <option value="" disabled>No active services found</option>
            )}
            {services.map(s => (
              <option key={s.id} value={s.name}>
                {s.name} — ₱{Number(s.price_from).toLocaleString('en-PH')}
                {UNIT_BASED_SLUGS.has(s.slug) ? ' / unit' : ''}
              </option>
            ))}
          </select>
        </Field>

        {/* Pricing info for selected service */}
        {selectedService && isUnitBased && (
          <div className="flex items-center gap-2 px-3 py-2 bg-pink-50 border border-pink-100 rounded-lg">
            <span className="text-xs font-medium text-pink-700">
              ₱{Number(selectedService.price_from).toLocaleString('en-PH')} per unit
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Service date" name="service_date" type="date" required />
          <Field label="Service time" name="service_time" type="time" required min={8} max={17} hint="8:00 AM – 5:00 PM">
            <input
              name="service_time"
              type="time"
              required
              min="08:00"
              max="17:00"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Space type" name="space_type" required>
            <select name="space_type" defaultValue="residential" className={`${inputClass} bg-white`}>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
            </select>
          </Field>

          {isUnitBased ? (
            <Field
              label="Quantity (units)"
              name="unit_quantity"
              type="number"
              min={1}
              step="1"
              required
              defaultValue="1"
              placeholder="e.g. 2"
            />
          ) : (
            <Field
              label="Property size (sqm)"
              name="property_sqm"
              type="number"
              min={1}
              step="1"
              required={!isUnitBased}
              placeholder="e.g. 50"
              hint="Price auto-calculated from sqm"
            />
          )}
        </div>
      </div>

      {/* ── Address ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <SectionLabel>Address</SectionLabel>
        <Field label="Unit / Suite" name="address_unit" placeholder="e.g. Unit 5B" />
        <Field label="Street" name="address_street" required placeholder="e.g. 123 Rizal Ave" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" name="address_city" required placeholder="e.g. Quezon City" />
          <Field label="Province" name="address_province" required placeholder="e.g. Metro Manila" />
        </div>
      </div>

      {/* ── Extras ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <SectionLabel>Extras</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Sofa qty" name="couch_quantity" type="number" min={0} defaultValue="0" />
          <Field label="Mattress qty" name="mattress_quantity" type="number" min={0} defaultValue="0" />
          <Field label="Furniture qty" name="furniture_quantity" type="number" min={0} defaultValue="0" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Special notes<span className="text-gray-400 font-normal text-xs ml-1">(optional)</span>
          </label>
          <textarea
            name="special_notes"
            rows={3}
            placeholder="Any special instructions or requests..."
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      {/* ── Payment Method ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <SectionLabel>Payment Method</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PAYMENT_METHODS.map(pm => (
            <button
              key={pm.value}
              type="button"
              onClick={() => setPaymentMethod(pm.value)}
              className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                paymentMethod === pm.value
                  ? 'border-pink-500 bg-pink-50 text-pink-700 ring-2 ring-pink-500/20'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {pm.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error ── */}
      {state?.error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={pending || !selectedCustomer}
        className="w-full py-3 bg-pink-600 text-white rounded-xl text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {pending ? 'Creating booking...' : 'Create Booking'}
      </button>
    </form>
  )
}
