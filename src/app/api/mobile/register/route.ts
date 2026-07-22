import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/server'
import { sendCustomerConfirmationEmail } from '@/lib/email'
import { PH_MOBILE_RE, EMAIL_RE, NAME_TEXT_RE, cleanText, describeEmailError } from '@/lib/validation'

// Public endpoint — the mobile app's customer self-registration screen posts
// here instead of calling supabase.auth.signUp() directly. Reuses the same
// generateLink({ type: 'signup' }) + branded-email pattern already proven for
// the admin-created-customer flow (see createCustomerAccount in
// src/app/actions/admin.ts), so confirmation always lands on the web's
// /auth/callback → /email-confirmed instead of depending on Supabase's
// default confirmation email deep-linking back into the app.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const full_name = cleanText(body.full_name, 80)
    const email = cleanText(body.email, 254).toLowerCase()
    const phone = cleanText(body.phone, 11) || null
    const password = typeof body.password === 'string' ? body.password : ''

    if (!full_name || full_name.length < 2) {
      return NextResponse.json({ error: 'Full name is required (at least 2 characters).' }, { status: 400 })
    }
    if (!NAME_TEXT_RE.test(full_name)) {
      return NextResponse.json({ error: 'Full name contains unsupported characters.' }, { status: 400 })
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: describeEmailError(email) }, { status: 400 })
    }
    if (phone && !PH_MOBILE_RE.test(phone)) {
      return NextResponse.json({ error: 'Enter a valid Philippine mobile number (09XXXXXXXXX).' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.maidforyouph.com'

    // generateLink(type: 'signup') both creates the (unconfirmed) auth user
    // and mints the token_hash for our own branded email — it errors like a
    // normal signUp() would if the email is already registered.
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: { full_name, phone },
        redirectTo: `${siteUrl}/auth/callback?next=/email-confirmed`,
      },
    })

    if (linkError) {
      const isDuplicate = /already (been )?registered|already exists/i.test(linkError.message)
      return NextResponse.json(
        { error: isDuplicate ? 'This email is already registered.' : linkError.message },
        { status: isDuplicate ? 409 : 500 }
      )
    }
    if (!linkData.user) {
      return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 })
    }

    // A DB trigger auto-provisions a bare profiles row (empty full_name, role
    // 'customer') the instant auth.users gets the new row — upsert so this
    // real data overwrites that stub instead of colliding with it.
    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: linkData.user.id,
      full_name,
      phone,
      role: 'customer',
      is_active: true,
    })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const confirmLink = `${siteUrl}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=signup&next=${encodeURIComponent('/email-confirmed')}`
    const { error: emailError } = await sendCustomerConfirmationEmail({ customerName: full_name, confirmLink }, email)

    if (emailError) {
      return NextResponse.json(
        { error: 'Account created, but the confirmation email failed to send. Please contact support.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
