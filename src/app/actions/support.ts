'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { createNotification } from './notifications'

export async function sendSupportMessage(
  customerId: string,
  message: string
): Promise<{ error?: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!message.trim()) return

  const adminClient = createAdminClient()

  const { error } = await adminClient.from('direct_messages').insert({
    customer_id: customerId,
    sender_id: user.id,
    message: message.trim(),
  })

  if (error) return { error: error.message }

  // Notify admins only when the sender is the customer (not when staff replies)
  if (user.id === customerId) {
    const [{ data: senderProfile }, { data: admins }] = await Promise.all([
      adminClient.from('profiles').select('full_name').eq('id', user.id).single(),
      adminClient.from('profiles').select('id').in('role', ['super_admin', 'branch_manager']),
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
}
