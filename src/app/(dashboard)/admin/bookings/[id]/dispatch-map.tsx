'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { BUSINESS_LAT, BUSINESS_LNG, BUSINESS_LABEL } from '@/lib/constants'
import type { RoadRoute } from '@/lib/openrouteservice'
import { haversineKm } from '@/lib/geo'

// Calls our own /api/route proxy rather than OpenRouteService directly — the
// ORS API key is server-only (see src/lib/openrouteservice.ts) and must never
// reach the browser bundle.
async function fetchRoadRoute(fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<RoadRoute | null> {
  try {
    const params = new URLSearchParams({
      fromLat: String(fromLat), fromLng: String(fromLng),
      toLat: String(toLat), toLng: String(toLng),
    })
    const res = await fetch(`/api/route?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.route as RoadRoute | null
  } catch {
    return null
  }
}

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
  departureSource: 'inter_job' | 'last_seen' | 'home' | 'business' | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const routeLayerRef = useRef<import('leaflet').Polyline | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)

  const fromLat = departureLat ?? BUSINESS_LAT
  const fromLng = departureLng ?? BUSINESS_LNG

  // Short label (legend) and long label (map pin popup) for each possible
  // departure-point source — see the fallback chain in src/lib/ai-assignment.ts.
  const DEPARTURE_LABELS: Record<string, { short: string; long: string }> = {
    inter_job: { short: 'Prior Job Location', long: 'Departure — Prior Same-Day Job Location' },
    last_seen: { short: 'Recent Location Ping', long: 'Departure — Recent Location Ping' },
    home:      { short: 'Home Address', long: 'Departure — Cleaner Home Address' },
    business:  { short: 'Business Office', long: `Departure — ${BUSINESS_LABEL}` },
  }
  const departureMeta = DEPARTURE_LABELS[departureSource ?? 'business'] ?? DEPARTURE_LABELS.business
  const departureLabel = departureMeta.long

  // Land-based route distance/duration, fetched via /api/route (OpenRouteService)
  // once the map is up. `undefined` = loading (falls back to a straight-line
  // estimate once the request resolves, so the figure shown is never blank for long).
  const [route, setRoute] = useState<{ distanceKm: number; durationMin: number; isRoad: boolean } | undefined>(undefined)

  // Reset to "loading" synchronously during render when the route's inputs
  // change, rather than via setState inside the effect below (React flags
  // that as a cascading-render risk) — this is the sanctioned pattern for
  // resetting derived state in response to changed props.
  const routeKey = `${fromLat},${fromLng},${bookingLat},${bookingLng}`
  const [lastRouteKey, setLastRouteKey] = useState(routeKey)
  if (routeKey !== lastRouteKey) {
    setLastRouteKey(routeKey)
    setRoute(undefined)
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    import('leaflet').then((L) => {
      if (!containerRef.current || mapRef.current) return
      leafletRef.current = L

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

      // Straight line as an immediate placeholder while the real road route
      // loads — replaced below once /api/route responds (or left as the
      // fallback if routing is unavailable).
      routeLayerRef.current = L.polyline([[fromLat, fromLng], [bookingLat, bookingLng]], {
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
      routeLayerRef.current = null
    }
  }, [fromLat, fromLng, bookingLat, bookingLng, departureLabel])

  // Fetch the real road route and redraw the line to follow actual roads
  // instead of cutting a straight line through whatever's in between.
  useEffect(() => {
    let cancelled = false

    fetchRoadRoute(fromLat, fromLng, bookingLat, bookingLng).then((result) => {
      if (cancelled) return

      if (result) {
        setRoute({ distanceKm: result.distanceKm, durationMin: result.durationMin, isRoad: true })

        // Redraw the placeholder straight line to follow the actual road path.
        // Guarded separately from the state update above: the map's async
        // Leaflet import may not have resolved yet even though the route
        // already has, and that timing shouldn't make an accurate result get
        // labeled as a straight-line estimate.
        const L = leafletRef.current
        const map = mapRef.current
        if (L && map) {
          routeLayerRef.current?.remove()
          routeLayerRef.current = L.polyline(result.geometry, {
            color: '#6366f1',
            weight: 3,
            opacity: 0.85,
          }).addTo(map)
          map.fitBounds(result.geometry, { padding: [28, 28] })
        }
      } else {
        // Routing unavailable (missing key, request failure, etc.) — keep the
        // straight-line placeholder already on the map and label the distance
        // as a straight-line estimate, not a road one.
        setRoute({ distanceKm: haversineKm(fromLat, fromLng, bookingLat, bookingLng), durationMin: 0, isRoad: false })
      }
    })

    return () => { cancelled = true }
  }, [fromLat, fromLng, bookingLat, bookingLng])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-[11px] text-gray-500 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
            {departureMeta.short}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
            Customer Location
          </span>
        </div>
        <span className="text-[11px] font-medium text-gray-500">
          {route === undefined
            ? 'Calculating road distance…'
            : `${route.distanceKm.toFixed(1)} km${route.isRoad ? ' by road' : ' (straight-line est.)'}${route.isRoad && route.durationMin > 0 ? ` · ~${Math.round(route.durationMin)} min` : ''}`}
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
