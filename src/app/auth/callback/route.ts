import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

// Rendered instead of verifying immediately on GET. token_hash links are
// single-use — Outlook Safe Links, corporate email scanners, and some
// antivirus products prefetch every URL in an incoming email to scan it,
// which silently burns the one-time token before the person ever clicks,
// so their real click then always lands on the "invalid or expired" error.
// Scanners issue GET requests and don't submit forms, so gating the actual
// verifyOtp() call behind this button's POST means only a real, deliberate
// click can ever consume the token.
function confirmPageHtml(token_hash: string, type: string, next: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Maid For You</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: #f9fafb; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px; max-width: 360px; width: calc(100% - 48px); text-align: center; }
  h1 { font-size: 18px; color: #111827; margin: 0 0 8px; }
  p { font-size: 14px; color: #6b7280; line-height: 1.5; margin: 0 0 24px; }
  button { background: #db2777; color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; padding: 12px 28px; cursor: pointer; width: 100%; }
  button:hover { background: #be185d; }
</style>
</head>
<body>
  <div class="card">
    <h1>Continue</h1>
    <p>Click below to continue to Maid For You.</p>
    <form method="POST" action="/auth/callback">
      <input type="hidden" name="token_hash" value="${escapeHtml(token_hash)}" />
      <input type="hidden" name="type" value="${escapeHtml(type)}" />
      <input type="hidden" name="next" value="${escapeHtml(next)}" />
      <button type="submit">Continue</button>
    </form>
  </div>
</body>
</html>`
}

async function verifyAndRedirect(
  token_hash: string,
  type: EmailOtpType,
  next: string,
  origin: string
): Promise<NextResponse> {
  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash })
  if (!error) {
    // Nothing meaningful lives on the web past this point for a brand-new
    // account — everything else happens in the mobile app — so signup/
    // invite confirmations land on a dedicated "you're confirmed" page
    // instead of wherever `next` (or its default, `/`) would send them.
    const destination = type === 'signup' || type === 'invite' ? '/email-confirmed' : next
    return NextResponse.redirect(`${origin}${destination}`)
  }
  return NextResponse.redirect(`${origin}/login?error=Link+is+invalid+or+has+expired.`)
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  // Password-reset / OAuth links use the PKCE `?code=` exchange.
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    return NextResponse.redirect(`${origin}/login?error=Link+is+invalid+or+has+expired.`)
  }

  // Signup confirmation / invite / magic-link / recovery links use
  // `token_hash` + `type` — render the confirm-and-POST page below instead
  // of verifying here, so a prefetch bot hitting this GET can't burn the
  // single-use token.
  if (token_hash && type) {
    return new NextResponse(confirmPageHtml(token_hash, type, next), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  return NextResponse.redirect(`${origin}/login?error=Link+is+invalid+or+has+expired.`)
}

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url)
  const form = await request.formData()
  const token_hash = form.get('token_hash')
  const type = form.get('type')
  const next = (form.get('next') as string) || '/'

  if (typeof token_hash !== 'string' || typeof type !== 'string' || !token_hash || !type) {
    return NextResponse.redirect(`${origin}/login?error=Link+is+invalid+or+has+expired.`)
  }

  return verifyAndRedirect(token_hash, type as EmailOtpType, next, origin)
}
