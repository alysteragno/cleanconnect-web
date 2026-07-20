/**
 * Land-based (road network) routing via OpenRouteService
 * (https://openrouteservice.org/dev/#/api-docs/v2/directions), which is
 * built on OpenStreetMap data — same source already used for geocoding
 * (Nominatim) and map tiles elsewhere in this app — and free at CleanConnect's
 * scale (2,000 requests/day on the free tier, no credit card required).
 *
 * Server-only: requires `ORS_API_KEY` (no `NEXT_PUBLIC_` prefix — unlike a
 * Mapbox "pk." token, an ORS key has no built-in public/client-safe variant,
 * so it must never reach the browser bundle). Client components that need a
 * route should call the `/api/route` endpoint instead of importing this
 * directly (see `src/app/api/route/route.ts`), which proxies through here
 * server-side and keeps the key secret.
 *
 * Distances here follow actual roads, unlike a haversine/great-circle line
 * which cuts straight through buildings, water, etc. Always degrades to
 * `null` on failure (missing key, timeout, rate limit, no route found) so
 * callers can fall back to a straight-line estimate rather than break
 * entirely.
 */

const ORS_DIRECTIONS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson'
const REQUEST_TIMEOUT_MS = 5000

export type RoadRoute = {
  distanceKm: number
  durationMin: number
  /** [lat, lng] pairs, in travel order — ready to hand straight to Leaflet's L.polyline. */
  geometry: [number, number][]
}

export async function getRoadRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RoadRoute | null> {
  const apiKey = process.env.ORS_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(ORS_DIRECTIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ coordinates: [[fromLng, fromLat], [toLng, toLat]] }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) return null

    const data = await res.json()
    const feature = data?.features?.[0]
    const coords = feature?.geometry?.coordinates as [number, number][] | undefined
    const summary = feature?.properties?.summary as { distance: number; duration: number } | undefined
    if (!feature || !coords || coords.length === 0 || !summary) return null

    return {
      distanceKm: summary.distance / 1000,
      durationMin: summary.duration / 60,
      geometry: coords.map(([lng, lat]) => [lat, lng]),
    }
  } catch {
    return null
  }
}
