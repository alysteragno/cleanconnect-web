'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export async function uploadPaymentQr(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return { error: 'Unauthorized.' }

  const file = formData.get('file') as File
  const method = formData.get('method') as string
  if (!file || !method) return { error: 'Missing file or method.' }

  const ext = file.name.split('.').pop() ?? 'png'
  const path = `qr-codes/${method}.${ext}`

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('payment-assets')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) return { error: uploadError.message }

  const { data } = admin.storage.from('payment-assets').getPublicUrl(path)
  return { url: data.publicUrl }
}

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

  const FIELD_LABELS: Record<string, string> = {
    gcash_number:           'GCash Number',
    gcash_name:             'GCash Account Name',
    gcash_qr_url:           'GCash QR Code',
    maya_number:            'Maya Number',
    maya_name:              'Maya Account Name',
    maya_qr_url:            'Maya QR Code',
    check_payable_to:       'Check Payable To',
    check_delivery_address: 'Check Delivery Address',
    payment_reference_note: 'Payment Reference Note',
  }

  const admin = createAdminClient()

  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    const value = (formData.get(key) as string)?.trim()
    if (!value) return { error: `${label} is required.` }
    await admin.from('settings').upsert({ key, value, updated_at: new Date().toISOString() })
  }

  // Bank accounts stored as a JSON array
  const bankAccountsRaw = (formData.get('bank_accounts') as string)?.trim()
  if (!bankAccountsRaw) return { error: 'Bank accounts are required.' }

  type BankEntry = { bank_name: string; account_number: string; account_name: string }
  let bankAccounts: BankEntry[]
  try {
    bankAccounts = JSON.parse(bankAccountsRaw)
    if (!Array.isArray(bankAccounts)) throw new Error()
  } catch {
    return { error: 'Invalid bank accounts data.' }
  }

  for (let i = 0; i < bankAccounts.length; i++) {
    const b = bankAccounts[i]
    if (!b.bank_name?.trim())     return { error: `Bank ${i + 1}: Bank name is required.` }
    if (!b.account_number?.trim()) return { error: `Bank ${i + 1}: Account number is required.` }
    if (!b.account_name?.trim())  return { error: `Bank ${i + 1}: Account name is required.` }
  }

  await admin.from('settings').upsert({
    key: 'bank_accounts',
    value: JSON.stringify(bankAccounts),
    updated_at: new Date().toISOString(),
  })

  revalidatePath('/admin/settings')
  return { success: 'Payment settings updated.' }
}
