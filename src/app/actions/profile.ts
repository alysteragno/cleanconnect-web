'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export type ProfileState = { error?: string; success?: boolean } | undefined

export async function updateProfile(
  state: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated.' }

  const full_name = (formData.get('full_name') as string).trim()
  const phone = (formData.get('phone') as string).trim() || null

  if (!full_name) return { error: 'Full name is required.' }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name, phone })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/customer/profile')
  revalidatePath('/customer')
  return { success: true }
}
