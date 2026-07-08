'use client'

import { useState } from 'react'
import { uploadCleanerPhoto } from '@/app/actions/admin'

type Props = {
  /** Existing photo URL (edit) — omit for a new cleaner. */
  initialUrl?: string | null
  /** Marks the field required and shows a prompt until a photo is uploaded. */
  required?: boolean
  /** Hidden input name carried into the form submission. */
  name?: string
}

export default function CleanerPhotoField({ initialUrl, required, name = 'photo_url' }: Props) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please upload a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.')
      return
    }

    setUploading(true)
    setError(null)

    const fd = new FormData()
    fd.set('file', file)

    const result = await uploadCleanerPhoto(fd)
    setUploading(false)
    if (result.error || !result.url) {
      setError(result.error ?? 'Upload failed. Please try again.')
      return
    }
    // Cache-bust so a replaced photo shows immediately.
    setUrl(`${result.url}?v=${Date.now()}`)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Cleaner Photo
        {required
          ? <span className="text-red-500 ml-0.5">*</span>
          : <span className="text-gray-400 font-normal ml-1">(optional)</span>}
      </label>

      {/* Carries the uploaded URL into the parent form submission */}
      <input type="hidden" name={name} value={url} />

      <div className="flex items-center gap-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Cleaner photo"
            className="w-24 h-24 rounded-full object-cover border border-gray-200 bg-gray-50 shrink-0"
          />
        ) : (
          <div className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300 shrink-0">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </div>
        )}

        <div className="space-y-2">
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {url ? 'Replace photo' : 'Upload photo'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleChange}
              disabled={uploading}
              className="hidden"
            />
          </label>
          <p className="text-xs text-gray-400">JPEG, PNG or WebP · max 5 MB</p>
          {uploading && <p className="text-xs text-gray-400">Uploading…</p>}
          {required && !url && !uploading && (
            <p className="text-xs text-gray-400">A photo is required before saving.</p>
          )}
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
