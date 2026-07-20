import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getRoadRoute } from '@/lib/openrouteservice'

// Server-side proxy for OpenRouteService road routing (see src/lib/openrouteservice.ts).
// Exists so the ORS_API_KEY never reaches the browser — client components
// (e.g. the AI dispatch map) call this instead of OpenRouteService directly.
// Super-admin only, since it's only used on the admin dispatch map and this
// keeps the free ORS quota from being burned by anyone who finds the route.
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const fromLat = parseFloat(searchParams.get('fromLat') ?? '')
    const fromLng = parseFloat(searchParams.get('fromLng') ?? '')
    const toLat   = parseFloat(searchParams.get('toLat') ?? '')
    const toLng   = parseFloat(searchParams.get('toLng') ?? '')

    if ([fromLat, fromLng, toLat, toLng].some((n) => isNaN(n))) {
      return NextResponse.json({ error: 'Invalid coordinates.' }, { status: 400 })
    }

    const route = await getRoadRoute(fromLat, fromLng, toLat, toLng)
    return NextResponse.json({ route })
  } catch {
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
