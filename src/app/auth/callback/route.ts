import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  const supabase = await createClient()

  // Password-reset / OAuth links use the PKCE `?code=` exchange.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  // Signup confirmation / invite links use `token_hash` + `type` instead —
  // exchangeCodeForSession() doesn't handle these at all, which is why
  // clicking a "confirm your email" link previously always fell through to
  // the invalid-link error below regardless of whether the link was valid.
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      // Nothing meaningful lives on the web past this point for a brand-new
      // account — everything else happens in the mobile app — so signup/
      // invite confirmations land on a dedicated "you're confirmed" page
      // instead of wherever `next` (or its default, `/`) would send them.
      const destination = type === 'signup' || type === 'invite' ? '/email-confirmed' : next
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Link+is+invalid+or+has+expired.`)
}
