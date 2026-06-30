'use client'

import { useActionState, useEffect, useState } from 'react'
import { updateSettings, uploadPaymentQr } from '@/app/actions/settings'
import { useFormStatus } from 'react-dom'
import { createClient } from '@/utils/supabase/client'
import { PaymentMethodIcon } from '@/components/payment-icons'

type BankEntry = { bank_name: string; account_number: string; account_name: string }

const EMPTY_BANK: BankEntry = { bank_name: '', account_number: '', account_name: '' }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-6 py-2.5 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Saving...' : 'Save changes'}
    </button>
  )
}

function BankCard({
  bank,
  index,
  onUpdate,
  onRemove,
}: {
  bank: BankEntry
  index: number
  onUpdate: (index: number, field: keyof BankEntry, value: string) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 relative">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
          aria-label="Remove bank"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
        <input
          type="text"
          value={bank.bank_name}
          onChange={e => onUpdate(index, 'bank_name', e.target.value)}
          placeholder="e.g. BDO Unibank"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
        <input
          type="text"
          value={bank.account_number}
          onChange={e => onUpdate(index, 'account_number', e.target.value)}
          placeholder="XXXX-XXXX-XXXX"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
        <input
          type="text"
          value={bank.account_name}
          onChange={e => onUpdate(index, 'account_name', e.target.value)}
          placeholder="Maid For You Cleaning Services"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
        />
      </div>
    </div>
  )
}

function QrUploader({
  method,
  inputName,
  defaultUrl,
}: {
  method: string
  inputName: string
  defaultUrl: string
}) {
  const [url, setUrl] = useState(defaultUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please upload a PNG, JPEG, or WebP image.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2 MB.')
      return
    }

    setUploading(true)
    setError(null)

    const fd = new FormData()
    fd.set('file', file)
    fd.set('method', method)

    const result = await uploadPaymentQr(fd)
    if (result.error) {
      setError(result.error)
      setUploading(false)
      return
    }

    // bust the CDN cache so the new image shows immediately
    setUrl(`${result.url}?v=${Date.now()}`)
    setUploading(false)
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        QR Code <span className="text-red-500">*</span>
      </label>
      {/* hidden input carries the URL into the form submission */}
      <input type="hidden" name={inputName} value={url} />
      <div className="flex items-start gap-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`${method} QR code`}
            className="w-36 h-36 object-contain border border-gray-200 rounded-xl p-2 bg-white"
          />
        ) : (
          <div className="w-36 h-36 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center text-xs text-gray-400 text-center p-3">
            No QR code uploaded
          </div>
        )}

        <div className="space-y-2 pt-1">
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {url ? 'Replace QR' : 'Upload QR'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleChange}
              className="hidden"
            />
          </label>
          <p className="text-xs text-gray-400">PNG, JPEG or WebP · max 2 MB</p>
          {uploading && <p className="text-xs text-gray-400">Uploading…</p>}
          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

type Settings = Record<string, string>

export default function AdminSettingsPage() {
  const [state, action] = useActionState(updateSettings, undefined)
  const [settings, setSettings] = useState<Settings>({})
  const [banks, setBanks] = useState<BankEntry[]>([])

  useEffect(() => {
    createClient()
      .from('settings')
      .select('key, value')
      .then(({ data }) => {
        if (!data) return
        const map = Object.fromEntries(data.map((r) => [r.key, r.value]))
        setSettings(map)
        if (map['bank_accounts']) {
          try { setBanks(JSON.parse(map['bank_accounts'])) } catch {}
        }
      })
  }, [])

  function updateBank(index: number, field: keyof BankEntry, value: string) {
    setBanks(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b))
  }

  function addBank() {
    setBanks(prev => [...prev, { ...EMPTY_BANK }])
  }

  function removeBank(index: number) {
    setBanks(prev => prev.filter((_, i) => i !== index))
  }

  const field = (key: string, label: string, placeholder?: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        name={key}
        type="text"
        defaultValue={settings[key] ?? ''}
        key={settings[key]}
        placeholder={placeholder}
        required
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
      />
    </div>
  )

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Payment Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          These details are shown to customers when they choose GCash, Maya, or bank transfer.
        </p>
      </div>

      <form action={action} className="space-y-6">
        {/* GCash */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <PaymentMethodIcon method="gcash" size={48} />
          {field('gcash_number', 'GCash Number', '09XX-XXX-XXXX')}
          {field('gcash_name', 'Account Name', 'Maid For You Cleaning Services')}
          <QrUploader
            key={settings['gcash_qr_url'] ?? 'gcash-qr'}
            method="gcash"
            inputName="gcash_qr_url"
            defaultUrl={settings['gcash_qr_url'] ?? ''}
          />
        </div>

        {/* Maya */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <PaymentMethodIcon method="maya" size={48} />
          {field('maya_number', 'Maya Number', '09XX-XXX-XXXX')}
          {field('maya_name', 'Account Name', 'Maid For You Cleaning Services')}
          <QrUploader
            key={settings['maya_qr_url'] ?? 'maya-qr'}
            method="maya"
            inputName="maya_qr_url"
            defaultUrl={settings['maya_qr_url'] ?? ''}
          />
        </div>

        {/* Bank Transfer — dynamic list */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <PaymentMethodIcon method="bank_transfer" size={48} />
              <p className="text-sm font-semibold text-gray-700">Bank Transfer</p>
            </div>
            <button
              type="button"
              onClick={addBank}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-pink-600 bg-pink-50 hover:bg-pink-100 border border-pink-200 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add bank
            </button>
          </div>

          {/* Hidden input — submits the full array as JSON */}
          <input type="hidden" name="bank_accounts" value={JSON.stringify(banks)} />

          {banks.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              No banks added yet. Click <span className="font-semibold">+ Add bank</span> to configure a bank transfer option.
            </p>
          ) : (
            <div className="space-y-3">
              {banks.map((bank, i) => (
                <BankCard
                  key={i}
                  bank={bank}
                  index={i}
                  onUpdate={updateBank}
                  onRemove={removeBank}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bank Check */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <PaymentMethodIcon method="bank_check" size={48} />
            <p className="text-sm font-semibold text-gray-700">Bank Check</p>
          </div>
          {field('check_payable_to', 'Make Check Payable To', 'Maid For You Cleaning Services')}
          {field('check_delivery_address', 'Deliver Check To', 'Unit 1, Bldg A, Cebu City')}
        </div>

        {/* Reference note */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-semibold text-gray-700 mb-4">Payment Reference Note</p>
          {field('payment_reference_note', 'Instruction shown to customers', 'Use your Booking ID as the payment reference…')}
        </div>

        {state?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-lg">
            {state.success}
          </p>
        )}

        <SubmitButton />
      </form>
    </div>
  )
}
