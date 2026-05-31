'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export type SettingsState = { error?: string; success?: string } | undefined

export async function getSettings(): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data } = await supabase.from('settings').select('key, value')
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
}

export async function updateSettings(
  state: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return { error: 'Unauthorized.' }

  const updates = [
    'gcash_number',
    'gcash_name',
    'bank_name',
    'bank_account_number',
    'bank_account_name',
    'payment_reference_note',
  ]

  const admin = createAdminClient()
  for (const key of updates) {
    const value = (formData.get(key) as string)?.trim()
    if (!value) return { error: `${key} cannot be empty.` }
    await admin.from('settings').upsert({ key, value, updated_at: new Date().toISOString() })
  }

  revalidatePath('/admin/settings')
  return { success: 'Payment settings updated.' }
}
