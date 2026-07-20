'use client'

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createManualBooking, createCustomerAccount } from '@/app/actions/admin'
import { serviceNeedsSqm, estimateBookingPrice, paymentStatusLabel } from '@/lib/booking-pricing'
import { SelectDropdown } from '@/components/dashboard/select-dropdown'

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
  value?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
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
  { value: 'cash',       label: 'Cash' },
  { value: 'gcash',      label: 'Online Payment (QRPh)' },
  { value: 'bank_check', label: 'Bank Check' },
]
const DIGITAL_PAYMENT_METHODS = new Set(['gcash'])

const SPACE_TYPE_OPTIONS = [
  { value: 'residential', label: 'Residential' },
  { value: 'condo',       label: 'Condo' },
  { value: 'office',      label: 'Office' },
  { value: 'commercial',  label: 'Commercial' },
]

const METRO_MANILA_CITIES = [
  'Caloocan', 'Las Piñas', 'Makati', 'Malabon', 'Mandaluyong', 'Manila',
  'Marikina', 'Muntinlupa', 'Navotas', 'Parañaque', 'Pasay', 'Pasig',
  'Pateros', 'Quezon City', 'San Juan', 'Taguig', 'Valenzuela',
].map(city => ({ value: city, label: city }))

// ── Service date / time pickers (same calendar design as the reports custom range picker) ──

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fromISO(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function fmtDateLabel(s: string) {
  return fromISO(s).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ServiceDatePicker({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => { const d = value ? fromISO(value) : new Date(); d.setDate(1); return d })
  const ref = useRef<HTMLDivElement>(null)
  const todayISO = toISO(new Date())

  function closeDropdown() { setClosing(true) }

  useEffect(() => {
    if (!open && !closing) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) closeDropdown()
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open, closing])

  function openPicker() {
    const d = value ? fromISO(value) : new Date()
    d.setDate(1)
    setViewMonth(d)
    setOpen(true)
  }

  function pickDay(iso: string) {
    if (iso < todayISO) return
    onChange(iso)
    closeDropdown()
  }

  const weeks = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
    const gridStart = new Date(first); gridStart.setDate(first.getDate() - first.getDay())
    return Array.from({ length: 6 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const day = new Date(gridStart)
        day.setDate(gridStart.getDate() + w * 7 + d)
        return day
      })
    )
  }, [viewMonth])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (open ? closeDropdown() : openPicker())}
        className={`w-full flex items-center justify-between gap-2 pl-3 pr-3 py-2 text-sm text-left
                   border rounded-lg bg-white transition-colors
                   ${open ? 'border-pink-300 ring-2 ring-pink-500/20 text-gray-900' : 'border-gray-300 text-gray-900 hover:border-gray-400'}`}
      >
        <span className={value ? '' : 'text-gray-400'}>
          {value ? fmtDateLabel(value) : 'Select a date...'}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {(open || closing) && (
        <div
          style={{ transformOrigin: 'top left' }}
          className={`absolute left-0 top-full mt-1.5 z-50 w-[280px] bg-white border border-gray-200
                     rounded-2xl shadow-lg shadow-gray-200/60 p-4 ${closing ? 'animate-dropdown-out' : 'animate-dropdown-in'}`}
          onAnimationEnd={() => { if (closing) { setClosing(false); setOpen(false) } }}
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d })}
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              ‹
            </button>
            <p className="text-xs font-semibold text-gray-800">
              {MONTH_LABELS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </p>
            <button
              type="button"
              onClick={() => setViewMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d })}
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((d) => (
              <p key={d} className="text-[10px] font-semibold text-gray-300 text-center py-1">{d}</p>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {weeks.flat().map((day) => {
              const iso = toISO(day)
              const inMonth = day.getMonth() === viewMonth.getMonth()
              const isPast = iso < todayISO
              const isSelected = iso === value
              const isToday = iso === todayISO
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={isPast}
                  onClick={() => pickDay(iso)}
                  className={`relative h-7 text-[11px] flex items-center justify-center transition-colors
                    ${!inMonth ? 'text-gray-300' : isPast ? 'text-gray-200 cursor-not-allowed' : 'text-gray-700'}
                    ${isSelected ? 'bg-pink-600 text-white font-semibold rounded-full z-10' : 'rounded-full hover:bg-pink-50'}
                    ${isToday && !isSelected ? 'ring-1 ring-inset ring-pink-300' : ''}
                  `}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const SERVICE_TIME_OPTIONS = (() => {
  const opts: { value: string; label: string }[] = []
  for (let h = 8; h <= 17; h++) {
    for (const m of [0, 30]) {
      if (h === 17 && m > 0) continue
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const period = h < 12 ? 'AM' : 'PM'
      const h12 = h % 12 === 0 ? 12 : h % 12
      opts.push({ value, label: `${h12}:${String(m).padStart(2, '0')} ${period}` })
    }
  }
  return opts
})()

function ServiceTimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  function closeDropdown() { setClosing(true) }

  useEffect(() => {
    if (!open && !closing) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) closeDropdown()
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open, closing])

  const activeLabel = SERVICE_TIME_OPTIONS.find(o => o.value === value)?.label

  function select(v: string) {
    onChange(v)
    closeDropdown()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (open ? closeDropdown() : setOpen(true))}
        className={`w-full flex items-center justify-between gap-2 pl-3 pr-3 py-2 text-sm text-left
                   border rounded-lg bg-white transition-colors
                   ${open ? 'border-pink-300 ring-2 ring-pink-500/20 text-gray-900' : 'border-gray-300 text-gray-900 hover:border-gray-400'}`}
      >
        <span className={activeLabel ? '' : 'text-gray-400'}>{activeLabel ?? 'Select a time...'}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 shrink-0">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      </button>

      {(open || closing) && (
        <div
          className={`absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200
                     rounded-xl shadow-lg shadow-gray-200/60 py-1.5 max-h-56 overflow-y-auto
                     ${closing ? 'animate-dropdown-out' : 'animate-dropdown-in'}`}
          onAnimationEnd={() => { if (closing) { setClosing(false); setOpen(false) } }}
        >
          {SERVICE_TIME_OPTIONS.map((o) => {
            const isActive = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => select(o.value)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                  isActive ? 'text-pink-700 bg-pink-50 font-semibold' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${isActive ? 'bg-pink-500' : 'bg-transparent'}`} />
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

type Customer = { id: string; full_name: string; phone: string | null }

function CustomerSelect({
  customers, onSelect, onCreateNew,
}: {
  customers: Customer[]
  onSelect: (c: Customer) => void
  onCreateNew: () => void
}) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  function closeDropdown() {
    setClosing(true)
  }

  useEffect(() => {
    if (!open && !closing) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) closeDropdown()
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open, closing])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(c => c.full_name.toLowerCase().includes(q))
  }, [customers, search])

  function select(c: Customer) {
    closeDropdown()
    setSearch('')
    onSelect(c)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (open ? closeDropdown() : setOpen(true))}
        disabled={customers.length === 0}
        className={`w-full flex items-center justify-between gap-2 pl-3 pr-3 py-2.5 text-sm font-medium text-left
                   border rounded-xl bg-gray-50 transition-colors active:scale-[0.99]
                   disabled:opacity-40 disabled:cursor-not-allowed
                   ${open
                     ? 'border-pink-300 ring-2 ring-pink-500/20 text-gray-900'
                     : 'border-gray-200 text-gray-800 hover:border-gray-300'}`}
      >
        <span className="truncate text-gray-400">
          {customers.length === 0 ? 'No customers yet' : 'Select a customer...'}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {(open || closing) && (
        <div
          style={{ transformOrigin: 'top center' }}
          className={`absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200
                     rounded-xl shadow-lg shadow-gray-200/60 overflow-hidden
                     ${closing ? 'animate-dropdown-out' : 'animate-dropdown-in'}`}
          onAnimationEnd={() => { if (closing) { setClosing(false); setOpen(false) } }}
        >
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-300 transition"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 text-center">
                No customers found.{' '}
                <button
                  type="button"
                  onClick={() => { closeDropdown(); onCreateNew() }}
                  className="text-pink-600 font-medium hover:text-pink-700"
                >
                  Create a new customer
                </button>
              </p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c)}
                  className="w-full text-left px-3 py-2 text-sm flex items-start gap-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 bg-transparent" />
                  <span className="min-w-0">
                    <span className="block font-medium truncate">{c.full_name}</span>
                    {c.phone && <span className="block text-xs text-gray-400">{c.phone}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

type Service = {
  id: string; name: string; slug: string
  starting_price: number; price_note: string | null; duration: string | null
}

export default function BookingForm({ services, customers }: { services: Service[]; customers: Customer[] }) {
  const [state, action, pending] = useActionState(createManualBooking, undefined)

  // Customer search state
  const [customerMode, setCustomerMode] = useState<'search' | 'create'>('search')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Create customer state
  const [createPending, startCreateTransition] = useTransition()
  const [createError, setCreateError] = useState<string | null>(null)
  const newFullNameRef = useRef<HTMLInputElement>(null)
  const newEmailRef = useRef<HTMLInputElement>(null)
  const newPhoneRef = useRef<HTMLInputElement>(null)

  // Service & pricing
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [serviceDate, setServiceDate] = useState('')
  const [serviceTime, setServiceTime] = useState('')
  const [propertySqm, setPropertySqm] = useState('')
  const [sofaSeaters, setSofaSeaters] = useState('')
  const [spaceType, setSpaceType] = useState('residential')

  // Address
  const [addressUnit, setAddressUnit] = useState('')
  const [addressStreet, setAddressStreet] = useState('')
  const [addressBarangay, setAddressBarangay] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [addressProvince, setAddressProvince] = useState('Metro Manila')

  // Payment
  const [paymentMethod, setPaymentMethod] = useState('cash')

  const selectedService = services.find(s => s.id === selectedServiceId)
  const needsSqm = serviceNeedsSqm(selectedService?.slug)
  const isSofaService = selectedService?.slug === 'sofa_couch_deep_cleaning'
  const isDigitalPayment = DIGITAL_PAYMENT_METHODS.has(paymentMethod)

  const estimatedPrice = useMemo(() => {
    if (!selectedService) return null
    const sqm = needsSqm ? (parseFloat(propertySqm) || 0) : 0
    return estimateBookingPrice(selectedService.slug, sqm, Number(selectedService.starting_price))
  }, [selectedService, needsSqm, propertySqm])

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c)
  }

  const serviceOptions = useMemo(
    () => services.map(s => ({
      value: s.id,
      label: `${s.name} — ${s.price_note ?? `from ₱${Number(s.starting_price).toLocaleString('en-PH')}`}`,
    })),
    [services]
  )

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
      <input type="hidden" name="service_id" value={selectedServiceId} />
      <input type="hidden" name="service_date" value={serviceDate} />
      <input type="hidden" name="service_time" value={serviceTime} />
      <input type="hidden" name="space_type" value={needsSqm ? spaceType : 'residential'} />
      <input type="hidden" name="address_city" value={addressCity} />
      <input type="hidden" name="payment_method" value={paymentMethod} />

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
              <CustomerSelect
                customers={customers}
                onSelect={selectCustomer}
                onCreateNew={() => setCustomerMode('create')}
              />
            ) : (
              <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full name<span className="text-red-400 ml-0.5">*</span></label>
                  <input ref={newFullNameRef} name="new_full_name" required className={`${inputClass} bg-white`} placeholder="Juan dela Cruz" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email<span className="text-red-400 ml-0.5">*</span></label>
                  <input ref={newEmailRef} name="new_email" type="email" required className={`${inputClass} bg-white`} placeholder="customer@email.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone<span className="text-red-400 ml-0.5">*</span></label>
                  <input ref={newPhoneRef} name="new_phone" type="tel" required maxLength={11} pattern="09[0-9]{9}" className={`${inputClass} bg-white`} placeholder="09XX XXX XXXX" />
                </div>

                {createError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{createError}</p>
                )}

                <button
                  type="button"
                  disabled={createPending}
                  onClick={() => {
                    const fd = new FormData()
                    fd.set('full_name', newFullNameRef.current?.value ?? '')
                    fd.set('email', newEmailRef.current?.value ?? '')
                    fd.set('phone', newPhoneRef.current?.value ?? '')
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

        <Field label="Service" name="service_id_select" required>
          <SelectDropdown
            value={selectedServiceId}
            onChange={setSelectedServiceId}
            options={serviceOptions}
            placeholder={services.length === 0 ? 'No active services found' : 'Select a service...'}
            disabled={services.length === 0}
          />
        </Field>

        {selectedService && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-pink-50 border border-pink-100 rounded-lg">
            <span className="text-xs font-medium text-pink-700">
              {selectedService.duration ? `Est. duration: ${selectedService.duration}` : 'Estimated price'}
            </span>
            {estimatedPrice != null && (
              <span className="text-sm font-bold text-pink-700">
                ₱{estimatedPrice.toLocaleString('en-PH')}
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Service date" name="service_date_select" required>
            <ServiceDatePicker value={serviceDate} onChange={setServiceDate} />
          </Field>
          <Field label="Service time" name="service_time_select" required hint="8:00 AM – 5:00 PM">
            <ServiceTimePicker value={serviceTime} onChange={setServiceTime} />
          </Field>
        </div>

        {needsSqm && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Space type" name="space_type_select" required>
              <SelectDropdown
                value={spaceType}
                onChange={setSpaceType}
                options={SPACE_TYPE_OPTIONS}
              />
            </Field>
            <Field
              label="Property size (sqm)"
              name="property_sqm"
              type="number"
              min={1}
              step="1"
              required
              value={propertySqm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPropertySqm(e.target.value)}
              placeholder="e.g. 50"
              hint="Price auto-calculated from sqm"
            />
          </div>
        )}

        {isSofaService && (
          <Field
            label="Sofa seaters"
            name="sofa_seaters"
            type="number"
            min={0}
            step="1"
            value={sofaSeaters}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSofaSeaters(e.target.value)}
            placeholder="e.g. 3"
          />
        )}
      </div>

      {/* ── Address ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <SectionLabel>Address</SectionLabel>
        <Field
          label="Unit / Suite" name="address_unit" required placeholder="e.g. Unit 5B"
          value={addressUnit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddressUnit(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Street" name="address_street" required placeholder="e.g. 123 Rizal Ave"
            value={addressStreet} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddressStreet(e.target.value)}
          />
          <Field
            label="Barangay" name="address_barangay" required placeholder="e.g. Malaya"
            value={addressBarangay} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddressBarangay(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" name="address_city_select" required>
            <SelectDropdown
              value={addressCity}
              onChange={setAddressCity}
              options={METRO_MANILA_CITIES}
              placeholder="Select a city..."
            />
          </Field>
          <Field
            label="Province" name="address_province" required placeholder="e.g. Metro Manila"
            value={addressProvince} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddressProvince(e.target.value)}
          />
        </div>
      </div>

      {/* ── Extras ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <SectionLabel>Extras</SectionLabel>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Other furniture / items<span className="text-gray-400 font-normal text-xs ml-1">(optional)</span>
          </label>
          <input name="other_furniture" className={inputClass} placeholder="e.g. 2 mattresses, 1 carpet" />
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
        <div className="grid grid-cols-3 gap-2">
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

        {isDigitalPayment && (
          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
            The customer pays through a PayMongo checkout link (GCash, Maya, or any bank app via QR) generated from the booking page — no reference number or proof needed here.
          </p>
        )}

        <p className="text-xs text-gray-400">
          Payment status will be set to <span className="font-semibold text-gray-600">&ldquo;{paymentStatusLabel('unpaid', paymentMethod)}&rdquo;</span> until confirmed.
        </p>
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
        disabled={pending || !selectedCustomer || !selectedServiceId || !serviceDate || !serviceTime || !addressCity}
        className="w-full py-3 bg-pink-600 text-white rounded-xl text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {pending ? 'Creating booking...' : 'Create Booking'}
      </button>
    </form>
  )
}
