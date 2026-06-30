'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { BUSINESS_LAT, BUSINESS_LNG, BUSINESS_LABEL } from '@/lib/constants'

export default function DispatchMap({
  bookingLat,
  bookingLng,
  departureLat,
  departureLng,
  departureSource,
}: {
  bookingLat: number
  bookingLng: number
  departureLat: number | null
  departureLng: number | null
  departureSource: 'inter_job' | 'business' | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)

  const fromLat = departureLat ?? BUSINESS_LAT
  const fromLng = departureLng ?? BUSINESS_LNG
  const isInterJob = departureSource === 'inter_job'

  const departureLabel = isInterJob
    ? 'Departure — Prior Same-Day Job Location'
    : `Departure — ${BUSINESS_LABEL}`

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    import('leaflet').then((L) => {
      if (!containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

      const bluePin = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2.5px solid white;box-shadow:0 1px 5px rgba(0,0,0,.35)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })

      const redPin = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2.5px solid white;box-shadow:0 1px 5px rgba(0,0,0,.35)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })

      L.marker([fromLat, fromLng], { icon: bluePin })
        .addTo(map)
        .bindPopup(`<strong>Departure</strong><br/>${departureLabel}`)

      L.marker([bookingLat, bookingLng], { icon: redPin })
        .addTo(map)
        .bindPopup('<strong>Customer Location</strong><br/>Service address')

      L.polyline([[fromLat, fromLng], [bookingLat, bookingLng]], {
        color: '#6366f1',
        weight: 2,
        dashArray: '6 5',
        opacity: 0.8,
      }).addTo(map)

      map.fitBounds(
        [[fromLat, fromLng], [bookingLat, bookingLng]],
        { padding: [28, 28] }
      )
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [fromLat, fromLng, bookingLat, bookingLng, departureLabel])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-[11px] text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
          {isInterJob ? 'Prior Job Location' : 'Business Office'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
          Customer Location
        </span>
      </div>
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-gray-200"
        style={{ height: 200 }}
      />
    </div>
  )
}
