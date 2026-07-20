'use client'

import { useState } from 'react'

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'quicktime'])

function isVideoUrl(url: string): boolean {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  return VIDEO_EXTENSIONS.has(ext)
}

function MediaSlot({ url, index }: { url: string; index: number }) {
  const [failed, setFailed] = useState(false)
  const isVideo = isVideoUrl(url)

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 hover:border-pink-400 transition-colors group"
    >
      {failed ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gray-50">
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-[10px] text-gray-400 font-medium">{isVideo ? 'View video' : 'View photo'}</span>
        </div>
      ) : isVideo ? (
        <video
          src={url}
          muted
          preload="metadata"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Furniture photo ${index + 1}`}
          onError={() => setFailed(true)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
        />
      )}
      {isVideo && !failed && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      )}
      <span className="absolute bottom-1.5 right-1.5 bg-black/50 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
        {index + 1}
      </span>
    </a>
  )
}

export default function FurniturePhotoGrid({ urls }: { urls: string[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {urls.map((url, i) => (
        <MediaSlot key={url} url={url} index={i} />
      ))}
    </div>
  )
}
