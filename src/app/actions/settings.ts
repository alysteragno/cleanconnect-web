'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export type SettingsState = { error?: string; success?: string } | undefined

export async function getSettings(): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data } = await supabase.from('settings').select('key, value')
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
}

// Bank Check is the only manually-configured payment method left — GCash, Maya,
// and bank transfer are now collected through PayMongo. The single setting is the
// name the check is made payable to.
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

  const check_payable_to = (formData.get('check_payable_to') as string)?.trim()
  if (!check_payable_to) return { error: 'Make Check Payable To is required.' }

  const admin = createAdminClient()
  await admin.from('settings').upsert({
    key: 'check_payable_to',
    value: check_payable_to,
    updated_at: new Date().toISOString(),
  })

  revalidatePath('/admin/settings')
  return { success: 'Bank check settings updated.' }
}
