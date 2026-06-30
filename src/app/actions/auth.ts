'use server'

import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getRateLimitBlock, recordLoginFailure, clearLoginFailures } from '@/utils/rate-limit'

export type AuthState = { error: string; remainingAttempts?: number } | undefined
export type ForgotState = { error?: string; success?: boolean } | undefined
export type ResetState = { error?: string } | undefined

async function getClientIp(): Promise<string> {
  const h = await headers()
  return (
    h.get('x-forwarded-for')?.split(',')[0].trim() ??
    h.get('x-real-ip') ??
    'unknown'
  )
}

const ROLE_ROUTES: Record<string, string> = {
  super_admin: '/admin',
  customer: '/customer',
}

const MOBILE_ONLY_ROLES = new Set(['cleaner'])

export async function login(state: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) return { error: 'Email and password are required.' }

  const ip = await getClientIp()
  const rateLimitKey = `login:${ip}`

  const blocked = getRateLimitBlock(rateLimitKey)
  if (blocked > 0) {
    const minutes = Math.ceil(blocked / 60)
    return { error: `Too many failed attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.` }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const result = recordLoginFailure(rateLimitKey)
    if (result.lockedFor) {
      const minutes = Math.ceil(result.lockedFor / 60)
      return { error: `Too many failed attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.` }
    }
    const WARN_THRESHOLD = 3
    if (result.remaining !== undefined && result.remaining <= WARN_THRESHOLD) {
      return { error: 'Invalid email or password.', remainingAttempts: result.remaining }
    }
    return { error: 'Invalid email or password.' }
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

  if (MOBILE_ONLY_ROLES.has(role)) {
    await supabase.auth.signOut()
    return { error: 'Please use the mobile app to sign in.' }
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

  redirect(ROLE_ROUTES[role] ?? '/customer')
}

export async function register(state: AuthState, formData: FormData): Promise<AuthState> {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirm = formData.get('confirm_password') as string
  const phone = (formData.get('phone') as string | null)?.trim() || null

  if (!name || !email || !password || !confirm) return { error: 'All fields are required.' }
  if (password !== confirm) return { error: 'Passwords do not match.' }
  if (password.length < 8)       return { error: 'Password must be at least 8 characters.' }
  if (!/[A-Z]/.test(password))   return { error: 'Password must contain at least one uppercase letter.' }
  if (!/[a-z]/.test(password))   return { error: 'Password must contain at least one lowercase letter.' }
  if (!/[0-9]/.test(password))   return { error: 'Password must contain at least one number.' }
  if (!/[^A-Za-z0-9]/.test(password)) return { error: 'Password must contain at least one special character.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) return { error: error.message }
  if (!data.user) return { error: 'Registration failed. Please try again.' }

  const adminClient = createAdminClient()
  const { error: profileError } = await adminClient.from('profiles').insert({
    id: data.user.id,
    full_name: name,
    role: 'customer',
    ...(phone && { phone }),
  })

  if (profileError) return { error: 'Account created but profile setup failed. Please contact support.' }

  // Clear any stale role cookie so a previous admin session can't redirect this new user to /admin
  const cookieStore = await cookies()
  cookieStore.delete('cleanconnect-role')

  redirect('/login?registered=true')
}

export async function forgotPassword(state: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = formData.get('email') as string
  if (!email) return { error: 'Email is required.' }

  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  })

  return { success: true }
}

export async function resetPassword(state: ResetState, formData: FormData): Promise<ResetState> {
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!password || !confirm) return { error: 'All fields are required.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (password !== confirm) return { error: 'Passwords do not match.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: error.message }

  redirect('/login?reset=true')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const cookieStore = await cookies()
  cookieStore.delete('cleanconnect-role')

  redirect('/login')
}
