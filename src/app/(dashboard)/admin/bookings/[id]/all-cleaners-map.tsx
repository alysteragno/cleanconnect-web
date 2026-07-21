'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { BUSINESS_LAT, BUSINESS_LNG } from '@/lib/constants'

export type CleanerLocation = {
  id: string
  full_name: string
  photo_url: string | null
  lat: number
  lng: number
  source: 'last_seen' | 'home'
  lastSeenAt: string | null
}

function formatRelativeTime(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

// Leaflet divIcon takes a raw HTML string, so any attribute value pulled from
// data (the photo URL) has to be escaped by hand — there's no JSX escaping to
// rely on here.
function escapeHtmlAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// Real photo when the cleaner has one on file, else the same colored-initials
// placeholder used everywhere else in the app. The source color (fresh ping
// vs home fallback) moves to the ring so it stays visible either way.
function markerHtml(c: CleanerLocation, size: number, color: string) {
  if (c.photo_url) {
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;background-image:url('${escapeHtmlAttr(c.photo_url)}');background-size:cover;background-position:center;border:2.5px solid ${color};box-shadow:0 1px 5px rgba(0,0,0,.35)"></div>`
  }
  return `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 1px 5px rgba(0,0,0,.35);color:white;font-size:10px;font-weight:700;font-family:sans-serif">${initials(c.full_name)}</div>`
}

// Same "tag every cleaner" map as /admin/cleaners — deliberately a standalone
// copy rather than a shared import, so this page's dispatch UI stays
// independent of the general cleaners page. Shown once Run AI Dispatch has
// been evaluated, so the admin can see where every cleaner currently is
// alongside the ranked recommendation, not just the top pick's departure pin.
export default function AllCleanersMap({ cleaners }: { cleaners: CleanerLocation[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    import('leaflet').then((L) => {
      if (!containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

      if (cleaners.length === 0) {
        map.setView([BUSINESS_LAT, BUSINESS_LNG], 13)
        return
      }

      const markers: [number, number][] = []
      cleaners.forEach((c) => {
        const color = c.source === 'last_seen' ? '#db2777' : '#9ca3af'
        const icon = L.divIcon({
          className: '',
          html: markerHtml(c, 28, color),
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        })
        const sourceLabel = c.source === 'last_seen'
          ? `Last seen ${c.lastSeenAt ? formatRelativeTime(c.lastSeenAt) : ''}`
          : 'Home address (no recent ping)'
        L.marker([c.lat, c.lng], { icon })
          .addTo(map)
          .bindPopup(`<strong>${c.full_name}</strong><br/>${sourceLabel}`)
        markers.push([c.lat, c.lng])
      })

      if (markers.length === 1) {
        map.setView(markers[0], 14)
      } else {
        map.fitBounds(markers, { padding: [32, 32] })
      }
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [cleaners])

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-gray-200"
        style={{ height: 240 }}
      />

      {cleaners.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-2">No cleaner locations on file yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {cleaners.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border border-gray-200 bg-gray-50"
            >
              {c.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.photo_url}
                  alt={c.full_name}
                  className="w-6 h-6 rounded-full object-cover shrink-0"
                  style={{ border: `2px solid ${c.source === 'last_seen' ? '#db2777' : '#9ca3af'}` }}
                />
              ) : (
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: c.source === 'last_seen' ? '#db2777' : '#9ca3af' }}
                >
                  {initials(c.full_name)}
                </span>
              )}
              <span className="text-xs font-medium text-gray-900">{c.full_name}</span>
              <span className="text-[10px] text-gray-400">
                {c.source === 'last_seen'
                  ? c.lastSeenAt ? formatRelativeTime(c.lastSeenAt) : 'recent ping'
                  : 'home address'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
