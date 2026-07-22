'use client'

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createManualBooking, createCustomerAccount, getCustomerBookingSlots } from '@/app/actions/admin'
import { serviceNeedsSqm, estimateBookingPrice, paymentStatusLabel } from '@/lib/booking-pricing'
import { SPACE_TYPES, METRO_MANILA_CITIES as METRO_MANILA_CITY_NAMES, PAYMENT_METHODS } from '@/lib/booking-constants'
import { SelectDropdown } from '@/components/dashboard/select-dropdown'
import {
  EMAIL_RE, NAME_TEXT_RE, PH_MOBILE_RE, describeEmailError,
  sanitizeAddressInput, sanitizeNameInput, sanitizeEmailInput, sanitizePhoneInput,
} from '@/lib/validation'

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
  label, name, required, hint, error, children, ...rest
}: {
  label: string; name: string; required?: boolean; hint?: string; error?: string
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
        <div className={error ? 'rounded-lg ring-2 ring-red-400/70' : ''}>
          {children}
        </div>
        {error ? (
          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
              <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
            </svg>
            {error}
          </p>
        ) : hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      </div>
    )
  }
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        {!required && <span className="text-gray-400 font-normal text-xs ml-1">(optional)</span>}
      </label>
      <input
        name={name} required={required}
        className={`${inputClass} ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
        {...rest}
      />
      {error ? (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
          </svg>
          {error}
        </p>
      ) : hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

const DIGITAL_PAYMENT_METHODS = new Set(['gcash'])

const FIELD_LABELS: Record<string, string> = {
  customer: 'Customer',
  service: 'Service',
  serviceDate: 'Service date',
  serviceTime: 'Service time',
  propertySqm: 'Property size',
  addressUnit: 'Unit / Suite',
  addressStreet: 'Street',
  addressBarangay: 'Barangay',
  addressCity: 'City',
  addressProvince: 'Province',
}

const SPACE_TYPE_OPTIONS = SPACE_TYPES.map((s) => ({ value: s.value, label: s.label }))

const METRO_MANILA_CITIES = METRO_MANILA_CITY_NAMES.map(city => ({ value: city, label: city }))

// ── Service date / time pickers (same calendar design as the reports custom range picker) ──

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Bookings must be made at least 24 hours ahead of the service slot.
function minBookableDateTime() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000)
}

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

function ServiceDatePicker({
  value, onChange, bookedDates,
}: { value: string; onChange: (iso: string) => void; bookedDates?: Set<string> }) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => { const d = value ? fromISO(value) : new Date(); d.setDate(1); return d })
  const ref = useRef<HTMLDivElement>(null)
  const todayISO = toISO(new Date())
  const minBookable = minBookableDateTime()

  // A day is bookable only if it's not a Sunday (no service on Sundays) and
  // its last available slot (5:00 PM) still meets the 24-hour lead time.
  function isDayBookable(day: Date) {
    if (day.getDay() === 0) return false
    const dayLastSlot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 17, 0, 0)
    return dayLastSlot >= minBookable
  }

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
    if (!isDayBookable(fromISO(iso)) || bookedDates?.has(iso)) return
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
              const isPast = !isDayBookable(day)
              const isBooked = !isPast && !!bookedDates?.has(iso)
              const isBlocked = isPast || isBooked
              const isSelected = iso === value
              const isToday = iso === todayISO
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={isBlocked}
                  onClick={() => pickDay(iso)}
                  title={isBooked ? 'This customer already has a booking on this date — blocked' : undefined}
                  className={`relative h-7 text-[11px] flex items-center justify-center transition-colors
                    ${!inMonth ? 'text-gray-300'
                      : isPast ? 'text-gray-200 cursor-not-allowed'
                      : isBooked ? 'text-red-300 line-through cursor-not-allowed'
                      : 'text-gray-700'}
                    ${isSelected ? 'bg-pink-600 text-white font-semibold rounded-full z-10' : 'rounded-full hover:bg-pink-50'}
                    ${isToday && !isSelected ? 'ring-1 ring-inset ring-pink-300' : ''}
                  `}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>

          {bookedDates && bookedDates.size > 0 && (
            <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-gray-100">
              <span className="w-1.5 h-1.5 rounded-full bg-red-300 shrink-0" />
              <p className="text-[10px] text-gray-400">Dates the customer is already booked on are blocked</p>
            </div>
          )}
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

function ServiceTimePicker({
  value, onChange, dateISO,
}: { value: string; onChange: (v: string) => void; dateISO: string }) {
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

  // Only offer times that still satisfy the 24-hour lead time for the chosen date.
  const availableOptions = useMemo(() => {
    if (!dateISO) return SERVICE_TIME_OPTIONS
    const minBookable = minBookableDateTime()
    return SERVICE_TIME_OPTIONS.filter(o => new Date(`${dateISO}T${o.value}:00`) >= minBookable)
  }, [dateISO])

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
          {availableOptions.length === 0 && (
            <p className="px-3 py-3 text-xs text-gray-400 text-center">No times available for this date.</p>
          )}
          {availableOptions.map((o) => {
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
  const [createAttempted, setCreateAttempted] = useState(false)
  const [newFullName, setNewFullName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')

  // Mirrors the server-side checks in createCustomerAccount (src/app/actions/admin.ts)
  // exactly, so an invalid submission never even leaves the browser — the
  // server still re-validates from scratch regardless, since this action can
  // always be called directly.
  const newCustomerErrors = useMemo(() => {
    const errors: Record<string, string> = {}
    const trimmedName = newFullName.trim()
    if (trimmedName.length < 2) errors.new_full_name = 'Full name is required (at least 2 characters).'
    else if (!NAME_TEXT_RE.test(trimmedName)) errors.new_full_name = 'Full name contains unsupported characters.'

    const trimmedEmail = newEmail.trim()
    if (!EMAIL_RE.test(trimmedEmail)) errors.new_email = describeEmailError(trimmedEmail)

    if (!PH_MOBILE_RE.test(newPhone)) errors.new_phone = 'Enter a valid Philippine mobile number (09XXXXXXXXX).'

    return errors
  }, [newFullName, newEmail, newPhone])
  const showNewCustomerErrors = createAttempted && Object.keys(newCustomerErrors).length > 0

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

  // Clear an already-picked time if a newly picked date makes it fall short
  // of the 24-hour lead time requirement.
  function handleServiceDateChange(iso: string) {
    setServiceDate(iso)
    setServiceTime((prevTime) => {
      if (!prevTime) return prevTime
      const dt = new Date(`${iso}T${prevTime}:00`)
      return dt < minBookableDateTime() ? '' : prevTime
    })
  }

  const selectedService = services.find(s => s.id === selectedServiceId)
  const needsSqm = serviceNeedsSqm(selectedService?.slug)
  const isSofaService = selectedService?.slug === 'sofa_couch_deep_cleaning'
  const isDigitalPayment = DIGITAL_PAYMENT_METHODS.has(paymentMethod)

  const estimatedPrice = useMemo(() => {
    if (!selectedService) return null
    const sqm = needsSqm ? (parseFloat(propertySqm) || 0) : 0
    return estimateBookingPrice(selectedService.slug, sqm, Number(selectedService.starting_price))
  }, [selectedService, needsSqm, propertySqm])

  // Every required field the submit button silently used to gate on, now
  // surfaced individually — so instead of a disabled button with no
  // explanation, the user sees exactly what's missing and where.
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)

  const fieldErrors = useMemo(() => {
    const errors: Record<string, string> = {}
    if (!selectedCustomer) errors.customer = 'Select an existing customer, or create a new one, before continuing.'
    if (!selectedServiceId) errors.service = 'Select a service.'
    if (!serviceDate) errors.serviceDate = 'Select a service date at least 24 hours from now.'
    if (!serviceTime) errors.serviceTime = 'Select a service time.'
    if (needsSqm) {
      const sqm = parseFloat(propertySqm)
      if (!propertySqm || isNaN(sqm) || sqm <= 0) errors.propertySqm = 'Enter a valid property size in sqm.'
    }
    if (!addressUnit.trim())     errors.addressUnit = 'Unit / suite is required.'
    if (!addressStreet.trim())   errors.addressStreet = 'Street address is required.'
    if (!addressBarangay.trim()) errors.addressBarangay = 'Barangay is required.'
    if (!addressCity)            errors.addressCity = 'Select a city.'
    if (!addressProvince.trim()) errors.addressProvince = 'Province is required.'
    return errors
  }, [
    selectedCustomer, selectedServiceId, serviceDate, serviceTime, needsSqm, propertySqm,
    addressUnit, addressStreet, addressBarangay, addressCity, addressProvince,
  ])

  const missingFieldCount = Object.keys(fieldErrors).length
  const showFieldErrors = attemptedSubmit && missingFieldCount > 0

  // Load the selected customer's existing (non-cancelled, upcoming) booking
  // dates once, as soon as they're picked, so the calendar can block those
  // dates outright — the customer simply can't be double-booked through
  // this form. createManualBooking still re-checks the exact same thing at
  // write time regardless, since this list can go stale the moment another
  // tab/admin books a slot for this customer.
  const [checkingCustomerSlots, startLoadCustomerSlots] = useTransition()
  const [customerBookedSlots, setCustomerBookedSlots] = useState<{ date: string; time: string }[]>([])
  const latestCustomerSlotsRequest = useRef('')
  const serviceDateRef = useRef(serviceDate)
  useEffect(() => { serviceDateRef.current = serviceDate }, [serviceDate])

  useEffect(() => {
    if (!selectedCustomer) return
    const customerId = selectedCustomer.id
    latestCustomerSlotsRequest.current = customerId
    startLoadCustomerSlots(async () => {
      const slots = await getCustomerBookingSlots(customerId)
      // Discard a response that resolved out of order — only the most
      // recently selected customer's slots should ever win.
      if (latestCustomerSlotsRequest.current !== customerId) return
      setCustomerBookedSlots(slots)
      // A date picked before this customer was selected (or before their
      // slots finished loading) might now be one of their booked dates —
      // clear it rather than leave a blocked date sitting selected.
      if (serviceDateRef.current && slots.some((s) => s.date === serviceDateRef.current)) {
        setServiceDate('')
        setServiceTime('')
      }
    })
  }, [selectedCustomer])

  // Gated on selectedCustomer so a stale set can never render once the
  // customer that produced it is no longer selected (e.g. "Change" clicked).
  const bookedDates = useMemo(
    () => (selectedCustomer ? new Set(customerBookedSlots.map((s) => s.date)) : new Set<string>()),
    [selectedCustomer, customerBookedSlots]
  )

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (missingFieldCount > 0 || checkingCustomerSlots) {
      e.preventDefault()
      setAttemptedSubmit(true)
    }
  }

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

  function handleCreateCustomer() {
    setCreateAttempted(true)
    if (Object.keys(newCustomerErrors).length > 0) return

    setCreateError(null)
    const fd = new FormData()
    fd.set('full_name', newFullName.trim())
    fd.set('email', newEmail.trim())
    fd.set('phone', newPhone)

    startCreateTransition(async () => {
      const result = await createCustomerAccount(fd)
      if (result.error) {
        setCreateError(result.error)
      } else if (result.customer) {
        setSelectedCustomer(result.customer)
        setCustomerMode('search')
        setNewFullName('')
        setNewEmail('')
        setNewPhone('')
        setCreateAttempted(false)
      }
    })
  }

  return (
    <form action={action} onSubmit={handleFormSubmit} className="space-y-5" noValidate>
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
                <Field
                  label="Full name" name="new_full_name" required maxLength={100}
                  placeholder="Juan dela Cruz" value={newFullName}
                  error={showNewCustomerErrors ? newCustomerErrors.new_full_name : undefined}
                  onChange={(e) => setNewFullName(sanitizeNameInput(e.target.value))}
                />
                <Field
                  label="Email" name="new_email" type="email" required maxLength={254}
                  placeholder="customer@email.com" value={newEmail}
                  error={showNewCustomerErrors ? newCustomerErrors.new_email : undefined}
                  onChange={(e) => setNewEmail(sanitizeEmailInput(e.target.value))}
                />
                <Field
                  label="Phone" name="new_phone" type="tel" required maxLength={11}
                  placeholder="09XX XXX XXXX" value={newPhone}
                  error={showNewCustomerErrors ? newCustomerErrors.new_phone : undefined}
                  onChange={(e) => setNewPhone(sanitizePhoneInput(e.target.value))}
                />

                {createError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{createError}</p>
                )}

                <button
                  type="button"
                  disabled={createPending}
                  onClick={handleCreateCustomer}
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

        {showFieldErrors && fieldErrors.customer && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
              <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
            </svg>
            {fieldErrors.customer}
          </p>
        )}
      </div>

      {/* ── Service Details ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <SectionLabel>Service Details</SectionLabel>

        <Field label="Service" name="service_id_select" required error={showFieldErrors ? fieldErrors.service : undefined}>
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
          <Field label="Service date" name="service_date_select" required error={showFieldErrors ? fieldErrors.serviceDate : undefined}>
            <ServiceDatePicker value={serviceDate} onChange={handleServiceDateChange} bookedDates={bookedDates} />
          </Field>
          <Field
            label="Service time" name="service_time_select" required hint="8:00 AM – 5:00 PM"
            error={showFieldErrors ? fieldErrors.serviceTime : undefined}
          >
            <ServiceTimePicker value={serviceTime} onChange={setServiceTime} dateISO={serviceDate} />
          </Field>
        </div>

        {checkingCustomerSlots && (
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 3a9 9 0 1 0 9 9" />
            </svg>
            Loading this customer&apos;s existing bookings...
          </p>
        )}

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
              error={showFieldErrors ? fieldErrors.propertySqm : undefined}
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
          maxLength={50}
          value={addressUnit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddressUnit(sanitizeAddressInput(e.target.value))}
          error={showFieldErrors ? fieldErrors.addressUnit : undefined}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Street" name="address_street" required placeholder="e.g. 123 Rizal Ave"
            maxLength={150}
            value={addressStreet} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddressStreet(sanitizeAddressInput(e.target.value))}
            error={showFieldErrors ? fieldErrors.addressStreet : undefined}
          />
          <Field
            label="Barangay" name="address_barangay" required placeholder="e.g. Malaya"
            maxLength={100}
            value={addressBarangay} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddressBarangay(sanitizeAddressInput(e.target.value))}
            error={showFieldErrors ? fieldErrors.addressBarangay : undefined}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" name="address_city_select" required error={showFieldErrors ? fieldErrors.addressCity : undefined}>
            <SelectDropdown
              value={addressCity}
              onChange={setAddressCity}
              options={METRO_MANILA_CITIES}
              placeholder="Select a city..."
            />
          </Field>
          <Field
            label="Province" name="address_province" required placeholder="e.g. Metro Manila"
            maxLength={100}
            value={addressProvince} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddressProvince(sanitizeAddressInput(e.target.value))}
            error={showFieldErrors ? fieldErrors.addressProvince : undefined}
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

      {/* ── Missing/invalid fields summary ── */}
      {showFieldErrors && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
          <span>
            <strong>{missingFieldCount} field{missingFieldCount > 1 ? 's need' : ' needs'} your attention:</strong>{' '}
            {Object.keys(fieldErrors).map((k) => FIELD_LABELS[k] ?? k).join(', ')}.{' '}
            Fix the highlighted fields above, then try again.
          </span>
        </div>
      )}

      {/* ── Error ── */}
      {state?.error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={pending || checkingCustomerSlots}
        className="w-full py-3 bg-pink-600 text-white rounded-xl text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {pending ? 'Creating booking...' : checkingCustomerSlots ? 'Loading customer bookings...' : 'Create Booking'}
      </button>
    </form>
  )
}
