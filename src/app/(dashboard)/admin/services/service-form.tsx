'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createService, updateService } from '@/app/actions/services'

type Service = {
  id: string
  name: string
  slug: string
  description: string | null
  starting_price: number
  price_note: string | null
  duration: string | null
  image_url: string | null
  sort_order: number
  category_id: string | null
}

type Category = { id: string; name: string }

function toSlug(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

const INPUT = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors'
const SELECT = `${INPUT} bg-white`

export default function ServiceForm({
  service,
  categories,
}: {
  service?: Service
  categories: Category[]
}) {
  const isEdit = !!service
  const [state, formAction, pending] = useActionState(
    isEdit ? updateService : createService,
    undefined
  )
  const router = useRouter()

  const [nameValue, setNameValue]   = useState(service?.name ?? '')
  const [slugValue, setSlugValue]   = useState(service?.slug ?? '')
  const [slugManual, setSlugManual] = useState(isEdit)
  const [previewUrl, setPreviewUrl] = useState<string | null>(service?.image_url ?? null)
  const [formKey, setFormKey]       = useState(0)

  useEffect(() => {
    if (!slugManual) setSlugValue(toSlug(nameValue))
  }, [nameValue, slugManual])

  useEffect(() => {
    if (!state?.success) return
    if (isEdit) {
      router.push('/admin/services')
    } else {
      setFormKey(k => k + 1)
      setNameValue('')
      setSlugValue('')
      setSlugManual(false)
      setPreviewUrl(null)
    }
  }, [state?.success, isEdit, router])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-semibold text-gray-700">
          {isEdit ? `Editing — ${service.name}` : 'New Service'}
        </p>
        {isEdit && (
          <a href="/admin/services" className="text-xs text-gray-400 hover:text-gray-600 transition-colors font-medium">
            ← Cancel
          </a>
        )}
      </div>

      <form key={formKey} action={formAction} className="space-y-5">
        {isEdit && (
          <>
            <input type="hidden" name="service_id" value={service.id} />
            {service.image_url && (
              <input type="hidden" name="existing_image_url" value={service.image_url} />
            )}
          </>
        )}

        {/* ── Section: Identity ─────────────────────────────────── */}
        <fieldset className="space-y-3">
          <legend className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Identity</legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Service Name *</label>
              <input
                name="name"
                type="text"
                required
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                placeholder="e.g. Aircon Cleaning"
                className={INPUT}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Slug *
              </label>
              <input
                name="slug"
                type="text"
                required
                value={slugValue}
                onChange={e => {
                  setSlugManual(true)
                  setSlugValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                }}
                placeholder="e.g. aircon_cleaning"
                className={`${INPUT} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select name="category_id" defaultValue={service?.category_id ?? ''} className={SELECT}>
                <option value="">— Uncategorized —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              name="description"
              rows={2}
              defaultValue={service?.description ?? ''}
              placeholder="Short description shown on the mobile service card..."
              className={`${INPUT} resize-none`}
            />
          </div>
        </fieldset>

        {/* ── Section: Pricing & Duration ───────────────────────── */}
        <fieldset className="space-y-3 pt-4 border-t border-gray-100">
          <legend className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Pricing &amp; Duration</legend>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Starting Price (₱) *</label>
              <input
                name="starting_price"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={service?.starting_price ?? ''}
                placeholder="700"
                className={INPUT}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Price Note <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                name="price_note"
                type="text"
                defaultValue={service?.price_note ?? ''}
                placeholder="e.g. ₱700 – ₱1,500"
                className={INPUT}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Duration <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                name="duration"
                type="text"
                defaultValue={service?.duration ?? ''}
                placeholder="e.g. 1–2 hrs"
                className={INPUT}
              />
            </div>
          </div>
        </fieldset>

        {/* ── Section: Image ────────────────────────────────────── */}
        <fieldset className="space-y-3 pt-4 border-t border-gray-100">
          <legend className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Image</legend>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Service Image <span className="text-gray-400 font-normal">(optional · max 5 MB · JPG / PNG / WebP)</span>
            </label>
            <div className="flex items-center gap-3">
              {previewUrl && (
                <div className="relative w-24 h-16 rounded-lg overflow-hidden border border-gray-200 shrink-0 bg-gray-50">
                  <Image src={previewUrl} alt="preview" fill className="object-cover" unoptimized />
                </div>
              )}
              <input
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) setPreviewUrl(URL.createObjectURL(file))
                }}
                className="block text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-xs file:font-medium file:text-gray-700 file:bg-white hover:file:bg-gray-50 file:cursor-pointer file:transition-colors"
              />
            </div>
          </div>

          <div className="w-32">
            <label className="block text-xs font-medium text-gray-700 mb-1">Sort Order</label>
            <input
              name="sort_order"
              type="number"
              min="0"
              defaultValue={service?.sort_order ?? 0}
              className={INPUT}
            />
          </div>
        </fieldset>

        {/* Feedback */}
        {state?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
            {state.success}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="px-5 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 transition-colors"
          >
            {pending
              ? (isEdit ? 'Saving...' : 'Creating...')
              : (isEdit ? 'Save Changes' : 'Create Service')}
          </button>
          {isEdit && (
            <a
              href="/admin/services"
              className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors inline-flex items-center"
            >
              Cancel
            </a>
          )}
        </div>
      </form>
    </div>
  )
}
