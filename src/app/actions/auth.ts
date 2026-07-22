'use server'

import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getRateLimitBlock, recordLoginFailure, clearLoginFailures } from '@/utils/rate-limit'
import { isAdminHost, getCurrentOrigin } from '@/utils/base-path'
import { resolveRoleHome, ADMIN_HOST } from '@/utils/hosts'
import { sendPasswordResetEmail } from '@/lib/email'

export type AuthState = {
  error?: string
  remainingAttempts?: number
  fieldErrors?: Record<string, string>
  fields?: Record<string, string>
} | undefined
export type ForgotState = { error?: string; success?: boolean } | undefined
export type ResetState = { error?: string; success?: boolean } | undefined

async function getClientIp(): Promise<string> {
  const h = await headers()
  return (
    h.get('x-forwarded-for')?.split(',')[0].trim() ??
    h.get('x-real-ip') ??
    'unknown'
  )
}

const MOBILE_ONLY_ROLES = new Set(['cleaner'])

// Only super_admin has an actual working web dashboard to sign back into.
// Cleaners are blocked from web login entirely, and the customer web
// dashboard is just a "mobile app coming soon" placeholder (see
// src/app/(dashboard)/customer/page.tsx) — so for every other role, bouncing
// back to the web sign-in form after a password reset dead-ends the same way.
const WEB_DASHBOARD_ROLES = new Set(['super_admin'])

export async function login(state: AuthState, formData: FormData): Promise<AuthState> {
  const rawEmail = (formData.get('email') as string ?? '').trim().toLowerCase()
  const password = formData.get('password') as string ?? ''

  const fields = { email: rawEmail }
  const fieldErrors: Record<string, string> = {}

  if (!rawEmail) fieldErrors.email = 'Email is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) fieldErrors.email = 'Enter a valid email address.'
  if (!password) fieldErrors.password = 'Password is required.'

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, fields }

  const email = rawEmail

  const ip = await getClientIp()
  const rateLimitKey = `login:${ip}`

  const blocked = getRateLimitBlock(rateLimitKey)
  if (blocked > 0) {
    const minutes = Math.ceil(blocked / 60)
    return { error: `Too many failed attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`, fields }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const result = recordLoginFailure(rateLimitKey)
    if (result.lockedFor) {
      const minutes = Math.ceil(result.lockedFor / 60)
      return { error: `Too many failed attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`, fields }
    }
    const WARN_THRESHOLD = 3
    if (result.remaining !== undefined && result.remaining <= WARN_THRESHOLD) {
      return { error: 'Invalid email or password.', remainingAttempts: result.remaining, fields }
    }
    return { error: 'Invalid email or password.', fields }
  }

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (!profile) {
    await supabase.auth.signOut()
    return { error: 'No account profile found. Please contact the administrator.' }
  }

  const role = profile.role
  const onAdminHost = await isAdminHost()

  if (MOBILE_ONLY_ROLES.has(role)) {
    await supabase.auth.signOut()
    return { error: 'Please use the mobile app to sign in.' }
  }

  if (role === 'super_admin' && !onAdminHost) {
    await supabase.auth.signOut()
    return { error: `Admin accounts must sign in at ${ADMIN_HOST}.` }
  }

  clearLoginFailures(rateLimitKey)

  const cookieStore = await cookies()
  cookieStore.set('cleanconnect-role', role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  redirect(resolveRoleHome(role, onAdminHost, await getCurrentOrigin()))
}

export async function register(state: AuthState, formData: FormData): Promise<AuthState> {
  const rawName  = (formData.get('name') as string ?? '').trim().slice(0, 100)
  const rawEmail = (formData.get('email') as string ?? '').trim().toLowerCase()
  const rawPhone = (formData.get('phone') as string ?? '').trim()
  const password = formData.get('password') as string ?? ''
  const confirm  = formData.get('confirm_password') as string ?? ''

  const fields = { name: rawName, email: rawEmail, phone: rawPhone }
  const fieldErrors: Record<string, string> = {}

  // Name
  if (!rawName) fieldErrors.name = 'Full name is required.'
  else if (rawName.length < 2) fieldErrors.name = 'Name must be at least 2 characters.'
  else if (!/^[\p{L}\p{M} .'-]+$/u.test(rawName)) fieldErrors.name = "Name can only contain letters, spaces, and . ' -"

  // Email
  if (!rawEmail) fieldErrors.email = 'Email is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) fieldErrors.email = 'Enter a valid email address.'

  // Phone
  if (!rawPhone) fieldErrors.phone = 'Phone number is required.'
  else if (!/^09\d{9}$/.test(rawPhone)) fieldErrors.phone = 'Enter a valid PH mobile number (09XXXXXXXXX).'

  // Password
  if (!password) {
    fieldErrors.password = 'Password is required.'
  } else {
    const missing: string[] = []
    if (password.length < 8)           missing.push('8+ characters')
    if (!/[A-Z]/.test(password))       missing.push('uppercase letter')
    if (!/[a-z]/.test(password))       missing.push('lowercase letter')
    if (!/[0-9]/.test(password))       missing.push('number')
    if (!/[^A-Za-z0-9]/.test(password)) missing.push('special character')
    if (missing.length > 0) fieldErrors.password = `Needs: ${missing.join(', ')}.`
  }

  // Confirm
  if (!confirm) fieldErrors.confirm_password = 'Please confirm your password.'
  else if (password && confirm !== password) fieldErrors.confirm_password = 'Passwords do not match.'

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, fields }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email: rawEmail, password })

  if (error) return { error: error.message, fields }
  if (!data.user) return { error: 'Registration failed. Please try again.', fields }

  // A DB trigger auto-provisions a bare profiles row (empty full_name, role
  // 'customer') the instant auth.users gets the new row — upsert so this
  // real data overwrites that stub instead of colliding with it.
  const adminClient = createAdminClient()
  const { error: profileError } = await adminClient.from('profiles').upsert({
    id: data.user.id,
    full_name: rawName,
    role: 'customer',
    ...(rawPhone && { phone: rawPhone }),
  })

  if (profileError) return { error: 'Account created but profile setup failed. Please contact support.', fields }

  // Sign out the auto-created session so the proxy won't redirect /login → /customer in a loop
  await supabase.auth.signOut()

  const cookieStore = await cookies()
  cookieStore.delete('cleanconnect-role')

  redirect('/login?registered=true')
}

export async function forgotPassword(state: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()
  if (!email) return { error: 'Email is required.' }

  // Supabase's own resetPasswordForEmail() throttles itself; generateLink()
  // below is a privileged admin call with no such built-in limit, so this
  // request needs its own IP-based throttle to keep the same abuse
  // resistance (reusing the login attempt limiter's sliding-window/lockout
  // logic under a separate key namespace).
  const ip = await getClientIp()
  const rateLimitKey = `forgot-password:${ip}`
  const blocked = getRateLimitBlock(rateLimitKey)
  if (blocked > 0) {
    const minutes = Math.ceil(blocked / 60)
    return { error: `Too many requests. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.` }
  }
  recordLoginFailure(rateLimitKey)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const adminClient = createAdminClient()

  // generateLink() errors when the email has no account — swallowed below so
  // the response never reveals whether an address is registered, the same
  // enumeration-safe contract Supabase's own resetPasswordForEmail had.
  //
  // Uses the same magic-link pattern as sendCustomerWelcomeEmail (see
  // createCustomerAccount in admin.ts) instead of Supabase's built-in
  // "reset password" email, so this flow also gets our branded template.
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

  return { success: true }
}

export async function resetPassword(state: ResetState, formData: FormData): Promise<ResetState> {
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!password || !confirm) return { error: 'All fields are required.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (password !== confirm) return { error: 'Passwords do not match.' }

  const supabase = await createClient()
  const { data: userData, error } = await supabase.auth.updateUser({ password })

  if (error) return { error: error.message }

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  // No working web destination for this role — stay on this page and tell
  // them to continue on the mobile app instead of redirecting to a web
  // sign-in form that dead-ends the same way.
  if (!profile || !WEB_DASHBOARD_ROLES.has(profile.role)) {
    await supabase.auth.signOut()
    return { success: true }
  }

  redirect('/login?reset=true')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const cookieStore = await cookies()
  cookieStore.delete('cleanconnect-role')

  redirect('/login')
}
