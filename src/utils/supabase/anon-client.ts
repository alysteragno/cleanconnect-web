import { createClient } from '@supabase/supabase-js'

// Session-less client used only for auth.signUp when admin creates new user accounts.
// Does NOT carry any existing user's JWT — so signUp produces a clean new session.
export function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
