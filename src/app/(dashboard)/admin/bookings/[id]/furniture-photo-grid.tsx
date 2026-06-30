'use client'

import { useState } from 'react'

function PhotoSlot({ url, index }: { url: string; index: number }) {
  const [failed, setFailed] = useState(false)

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
          <span className="text-[10px] text-gray-400 font-medium">View photo</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Furniture photo ${index + 1}`}
          onError={() => setFailed(true)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
        />
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
      {Array.from({ length: 5 }).map((_, i) => {
        const url = urls[i]
        return url ? (
          <PhotoSlot key={i} url={url} index={i} />
        ) : (
          <div
            key={i}
            className="relative aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1"
          >
            <svg className="w-5 h-5 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] text-gray-300 font-medium">Photo {i + 1}</span>
          </div>
        )
      })}
    </div>
  )
}
