'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { createNotification } from './notifications'

export async function sendSupportMessage(
  customerId: string,
  message: string
): Promise<{ error?: string; message?: { id: string; message: string; created_at: string; sender_id: string } } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!message.trim()) return

  const adminClient = createAdminClient()

  // Staff replies go to admin_messages; customer messages go to direct_messages.
  const isStaffSender = user.id !== customerId
  const table = isStaffSender ? 'admin_messages' : 'direct_messages'

  const { error } = await adminClient
    .from(table)
    .insert({ customer_id: customerId, sender_id: user.id, message: message.trim() })

  if (error) return { error: error.message }

  // Fetch the just-inserted row so the client can optimistically update without a reload
  const { data: newMsg } = await adminClient
    .from(table)
    .select('id, message, created_at, sender_id')
    .eq('customer_id', customerId)
    .eq('sender_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Notify admins only when the sender is the customer (not when staff replies)
  if (user.id === customerId) {
    const [{ data: senderProfile }, { data: admins }] = await Promise.all([
      adminClient.from('profiles').select('full_name').eq('id', user.id).single(),
      adminClient.from('profiles').select('id').eq('role', 'super_admin'),
    ])

    const senderName = senderProfile?.full_name ?? 'A customer'

    await Promise.all(
      (admins ?? []).map((admin: { id: string }) =>
        createNotification({
          userId: admin.id,
          title: 'New support message',
          body: `${senderName} sent you a message.`,
          type: 'direct_message',
          customerId,
        })
      )
    )
  }

  revalidatePath('/customer/support')
  revalidatePath(`/admin/support/${customerId}`)

  return { message: newMsg ?? undefined }
}

// Admin-initiated chat: start a new support conversation with a chosen customer
// by sending the first message as staff (admin_messages). Used by the "New chat"
// button on the admin support list. Super-admin only.
export async function startSupportChat(
  formData: FormData
): Promise<{ error?: string; customerId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return { error: 'Unauthorized.' }

  const customer_id = (formData.get('customer_id') as string ?? '').trim()
  const message      = (formData.get('message') as string ?? '').trim()

  if (!customer_id) return { error: 'Please select a customer.' }
  if (!message)     return { error: 'Please enter a message.' }

  const admin = createAdminClient()

  const { data: target } = await admin
    .from('profiles').select('id, role').eq('id', customer_id).single()
  if (!target || target.role !== 'customer') return { error: 'Selected customer not found.' }

  const { error } = await admin
    .from('admin_messages')
    .insert({ customer_id, sender_id: user.id, message })
  if (error) return { error: error.message }

  await createNotification({
    userId: customer_id,
    title: 'New message from Support',
    body: message,
    type: 'direct_message',
    customerId: customer_id,
  })

  revalidatePath('/admin/support')
  revalidatePath('/customer/support')
  return { customerId: customer_id }
}

// Manually archive/restore a support conversation. Never deletes any
// messages — the thread stays fully readable and can be restored anytime.
// Super-admin only.
export async function setSupportConversationArchived(
  customerId: string,
  archived: boolean
): Promise<{ error?: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { error } = await admin
    .from('support_conversations')
    .upsert({
      customer_id: customerId,
      archived_at: archived ? now : null,
      restored_at: archived ? null : now,
    })
  if (error) return { error: error.message }

  revalidatePath('/admin/support')
  revalidatePath(`/admin/support/${customerId}`)
}
