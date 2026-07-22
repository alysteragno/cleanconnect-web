import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/server'
import { sendPasswordResetEmail } from '@/lib/email'
import { getRateLimitBlock, recordLoginFailure } from '@/utils/rate-limit'

// Public endpoint — the mobile app's forgot-password screen posts here
// instead of calling supabase.auth.resetPasswordForEmail() directly. Reuses
// the exact same generateLink({ type: 'magiclink' }) + branded-email pattern
// as the web's own /forgot-password (see forgotPassword in
// src/app/actions/auth.ts), so both surfaces send the identical email and
// land on the same server-verified /auth/callback → /reset-password route
// instead of mobile's old implicit-flow hash-fragment link.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const email = (typeof body?.email === 'string' ? body.email : '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    // Supabase's own resetPasswordForEmail() throttled itself; generateLink()
    // below is a privileged admin call with no such built-in limit — same
    // IP-based throttle as the web action, reusing the login limiter's
    // sliding-window/lockout logic under a separate key namespace.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown'
    const rateLimitKey = `forgot-password:${ip}`
    const blocked = getRateLimitBlock(rateLimitKey)
    if (blocked > 0) {
      const minutes = Math.ceil(blocked / 60)
      return NextResponse.json(
        { error: `Too many requests. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.` },
        { status: 429 }
      )
    }
    recordLoginFailure(rateLimitKey)

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.maidforyouph.com'
    const adminClient = createAdminClient()

    // generateLink() errors when the email has no account — swallowed below
    // so the response never reveals whether an address is registered, the
    // same enumeration-safe contract Supabase's own resetPasswordForEmail had.
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${siteUrl}/auth/callback?next=/reset-password` },
    })

    if (!linkError && linkData.user) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('full_name')
        .eq('id', linkData.user.id)
        .single()

      const magicLink = `${siteUrl}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=magiclink&next=${encodeURIComponent('/reset-password')}`
      await sendPasswordResetEmail({ customerName: profile?.full_name || 'there', magicLink }, email)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: true })
  }
}
