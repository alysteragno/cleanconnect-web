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
