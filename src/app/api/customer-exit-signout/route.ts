import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

// Fired via navigator.sendBeacon() when a customer leaves /customer (nav away,
// tab close, refresh — anything that unloads the page). Customers have no web
// dashboard beyond the "get the mobile app" placeholder, so there's no reason
// to keep a browser session alive once they've left it.
export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const cookieStore = await cookies()
  cookieStore.delete('cleanconnect-role')

  return NextResponse.json({ ok: true })
}
