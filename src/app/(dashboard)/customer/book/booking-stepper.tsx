'use client'

import { useActionState, useState } from 'react'
import { createBooking } from '@/app/actions/bookings'

type Branch = { id: string; name: string; region: string }

type FormData = {
  // Step 1 — Address
  address_unit: string
  address_street: string
  address_city: string
  address_province: string
  branch_id: string
  // Step 2 — Service
  service_type: string
  space_type: string
  property_sqm: string
  special_notes: string
  // Step 3 — Schedule
  service_date: string
  service_time: string
  // Step 5 — Payment
  payment_method: string
}

const SERVICE_TYPES = [
  { value: 'general', label: 'General Home Cleaning', desc: 'Floors, surfaces, bathrooms & kitchen' },
  { value: 'premium_mattress', label: 'Mattress & Upholstery', desc: 'Deep clean for mattresses and sofas' },
  { value: 'complete', label: 'Complete Package', desc: 'Full clean with steam sterilization' },
  { value: 'disinfection', label: 'Disinfection', desc: 'Professional-grade sanitization' },
  { value: 'post_construction', label: 'Post-Construction', desc: 'Dust and debris removal after renos' },
]

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', desc: 'Pay the cleaner upon job completion' },
  { value: 'gcash', label: 'GCash', desc: 'Online payment via GCash (coming soon)' },
  { value: 'card', label: 'Card', desc: 'Credit or debit card (coming soon)' },
]

function computeEstimate(sqm: number) {
  if (!sqm || sqm <= 0) return null
  if (sqm <= 30) return { cleaners: 1, hours: 2, price: 1000 }
  if (sqm <= 60) return { cleaners: 2, hours: 3, price: 1800 }
  if (sqm <= 100) return { cleaners: 3, hours: 4, price: 2500 }
  const extra = Math.ceil((sqm - 100) / 50)
  return { cleaners: 3 + extra, hours: 4 + extra, price: 2500 + extra * 800 }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(timeStr: string) {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

const STEPS = ['Address', 'Service', 'Schedule', 'Review', 'Payment']

export default function BookingStepper({ branches }: { branches: Branch[] }) {
  const [step, setStep] = useState(1)
  const [stepError, setStepError] = useState('')
  const [formData, setFormData] = useState<FormData>({
    address_unit: '',
    address_street: '',
    address_city: '',
    address_province: '',
    branch_id: branches[0]?.id ?? '',
    service_type: 'general',
    space_type: 'residential',
    property_sqm: '',
    special_notes: '',
    service_date: '',
    service_time: '',
    payment_method: 'cash',
  })

  const [actionState, action, pending] = useActionState(createBooking, undefined)

  const set = (key: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    setStepError('')
  }

  const estimate = computeEstimate(parseFloat(formData.property_sqm) || 0)
  const today = new Date()
  today.setDate(today.getDate() + 1)
  const minDate = today.toISOString().split('T')[0]

  const selectedBranch = branches.find((b) => b.id === formData.branch_id)
  const selectedService = SERVICE_TYPES.find((s) => s.value === formData.service_type)

  function validateStep(s: number): string {
    if (s === 1) {
      if (!formData.address_street.trim()) return 'Street address is required.'
      if (!formData.address_city.trim()) return 'City is required.'
      if (!formData.address_province.trim()) return 'Province is required.'
      if (!formData.branch_id) return 'Please select a branch.'
    }
    if (s === 2) {
      if (!formData.property_sqm || parseFloat(formData.property_sqm) <= 0)
        return 'Please enter a valid property size.'
    }
    if (s === 3) {
      if (!formData.service_date) return 'Please select a service date.'
      if (formData.service_date <= new Date().toISOString().split('T')[0])
        return 'Service date must be at least one day from today.'
      if (!formData.service_time) return 'Please select a service time.'
    }
    return ''
  }

  function advance() {
    const err = validateStep(step)
    if (err) { setStepError(err); return }
    setStep((s) => s + 1)
  }

  return (
    <div className="max-w-2xl">
      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => {
          const n = i + 1
          const active = n === step
          const done = n < step
          return (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    done
                      ? 'bg-green-500 text-white'
                      : active
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {done ? '✓' : n}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${
                    active ? 'text-blue-600' : done ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 rounded ${done ? 'bg-green-400' : 'bg-gray-200'}`}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Step 1 — Address */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Service Address</h2>
            <p className="text-sm text-gray-500 mt-0.5">Where should the cleaner go?</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit / House No.</label>
              <input
                type="text"
                placeholder="e.g. Unit 4B"
                value={formData.address_unit}
                onChange={(e) => set('address_unit', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street *</label>
              <input
                type="text"
                placeholder="e.g. Rizal Avenue"
                value={formData.address_street}
                onChange={(e) => set('address_street', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input
                type="text"
                placeholder="e.g. Quezon City"
                value={formData.address_city}
                onChange={(e) => set('address_city', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Province *</label>
              <input
                type="text"
                placeholder="e.g. Metro Manila"
                value={formData.address_province}
                onChange={(e) => set('address_province', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nearest Branch *</label>
            <select
              value={formData.branch_id}
              onChange={(e) => set('branch_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.region}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Step 2 — Service Details */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Service Details</h2>
            <p className="text-sm text-gray-500 mt-0.5">Tell us about the job.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Service Type *</label>
            <div className="space-y-2">
              {SERVICE_TYPES.map((s) => (
                <label
                  key={s.value}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    formData.service_type === s.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="service_type_radio"
                    value={s.value}
                    checked={formData.service_type === s.value}
                    onChange={() => set('service_type', s.value)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.label}</p>
                    <p className="text-xs text-gray-500">{s.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Space Type</label>
            <div className="flex gap-3">
              {['residential', 'commercial'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => set('space_type', type)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                    formData.space_type === type
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Size (sqm) *
            </label>
            <input
              type="number"
              step="0.1"
              min="1"
              placeholder="e.g. 45"
              value={formData.property_sqm}
              onChange={(e) => set('property_sqm', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {estimate && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-base font-bold text-blue-800">₱{estimate.price.toLocaleString()}</p>
                  <p className="text-xs text-blue-600">Base price</p>
                </div>
                <div>
                  <p className="text-base font-bold text-blue-800">{estimate.cleaners}</p>
                  <p className="text-xs text-blue-600">{estimate.cleaners === 1 ? 'Cleaner' : 'Cleaners'}</p>
                </div>
                <div>
                  <p className="text-base font-bold text-blue-800">{estimate.hours}h</p>
                  <p className="text-xs text-blue-600">Duration</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Focus on the kitchen. Cat in the house."
              value={formData.special_notes}
              onChange={(e) => set('special_notes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      )}

      {/* Step 3 — Schedule */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Schedule</h2>
            <p className="text-sm text-gray-500 mt-0.5">When should the cleaner arrive?</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Date *</label>
              <input
                type="date"
                min={minDate}
                value={formData.service_date}
                onChange={(e) => set('service_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Time *</label>
              <input
                type="time"
                value={formData.service_time}
                onChange={(e) => set('service_time', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 4 — Review */}
      {step === 4 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Booking Review</h2>
            <p className="text-sm text-gray-500 mt-0.5">Confirm your details before paying.</p>
          </div>
          <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-200">
            <Row label="Branch" value={selectedBranch?.name ?? '—'} />
            <Row
              label="Address"
              value={[formData.address_unit, formData.address_street, formData.address_city, formData.address_province]
                .filter(Boolean)
                .join(', ')}
            />
            <Row label="Service" value={selectedService?.label ?? '—'} />
            <Row label="Space Type" value={formData.space_type.charAt(0).toUpperCase() + formData.space_type.slice(1)} />
            <Row label="Property Size" value={`${formData.property_sqm} sqm`} />
            <Row label="Date" value={formatDate(formData.service_date)} />
            <Row label="Time" value={formatTime(formData.service_time)} />
            {formData.special_notes && <Row label="Notes" value={formData.special_notes} />}
          </div>

          {estimate && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Estimate</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-bold text-blue-800">₱{estimate.price.toLocaleString()}</p>
                  <p className="text-xs text-blue-600 mt-0.5">Base price</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-blue-800">{estimate.cleaners}</p>
                  <p className="text-xs text-blue-600 mt-0.5">{estimate.cleaners === 1 ? 'Cleaner' : 'Cleaners'}</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-blue-800">{estimate.hours}h</p>
                  <p className="text-xs text-blue-600 mt-0.5">Duration</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 5 — Payment Method + hidden form submission */}
      {step === 5 && (
        <form action={action}>
          {/* All collected form data as hidden inputs */}
          {(Object.entries(formData) as [string, string][]).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}

          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Payment Method</h2>
              <p className="text-sm text-gray-500 mt-0.5">How would you like to pay?</p>
            </div>

            <div className="space-y-2">
              {PAYMENT_METHODS.map((pm) => (
                <label
                  key={pm.value}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    formData.payment_method === pm.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value={pm.value}
                    checked={formData.payment_method === pm.value}
                    onChange={() => set('payment_method', pm.value)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{pm.label}</p>
                    <p className="text-xs text-gray-500">{pm.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {actionState?.error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                {actionState.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? 'Confirming booking...' : 'Confirm booking'}
            </button>
          </div>
        </form>
      )}

      {/* Step error */}
      {stepError && (
        <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          {stepError}
        </p>
      )}

      {/* Nav buttons */}
      {step < 5 && (
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={() => { setStepError(''); setStep((s) => s - 1) }}
            disabled={step === 1}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 transition-colors"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={advance}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {step === 4 ? 'Choose payment →' : 'Next →'}
          </button>
        </div>
      )}
      {step === 5 && (
        <button
          type="button"
          onClick={() => { setStepError(''); setStep(4) }}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back
        </button>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-4 py-3 gap-4">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  )
}
