'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export type AuthState = { error: string } | undefined

const ROLE_ROUTES: Record<string, string> = {
  super_admin: '/admin',
  customer: '/customer',
}

const MOBILE_ONLY_ROLES = new Set(['branch_manager', 'cleaner'])

export async function login(state: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) return { error: 'Email and password are required.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }

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

  const cookieStore = await cookies()
  cookieStore.set('cleanconnect-role', role, {
    httpOnly: false,
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

  if (!name || !email || !password) return { error: 'All fields are required.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) return { error: error.message }
  if (!data.user) return { error: 'Registration failed. Please try again.' }

  const adminClient = createAdminClient()
  const { error: profileError } = await adminClient.from('profiles').insert({
    id: data.user.id,
    full_name: name,
    role: 'customer',
  })

  if (profileError) return { error: 'Account created but profile setup failed. Please contact support.' }

  redirect('/login?registered=true')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const cookieStore = await cookies()
  cookieStore.delete('cleanconnect-role')

  redirect('/login')
}
