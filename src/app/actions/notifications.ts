'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export async function createNotification({
  userId,
  title,
  body,
  type,
  bookingId,
  complaintId,
}: {
  userId: string
  title: string
  body: string
  type: string
  bookingId?: string
  complaintId?: string
}) {
  const admin = createAdminClient()
  await admin.from('notifications').insert({
    user_id: userId,
    title,
    body,
    type,
    booking_id: bookingId ?? null,
    complaint_id: complaintId ?? null,
  })
}

export async function markNotificationRead(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', user.id)
}

export async function markAllNotificationsRead() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)
  revalidatePath('/', 'layout')
}
