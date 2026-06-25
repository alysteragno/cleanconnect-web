'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { createNotification } from './notifications'

export async function createAnnouncement(_prevState: unknown, formData: FormData) {
  const title = (formData.get('title') as string)?.trim()
  const body  = (formData.get('body')  as string)?.trim() || null

  if (!title) return { error: 'Title is required.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('announcements').insert({ title, body, created_by: user?.id ?? null })
  if (error) return { error: error.message }

  // Fan out an in-app notification to all active customers
  const { data: customers } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'customer')
    .eq('is_active', true)

  if (customers && customers.length > 0) {
    await Promise.all(
      customers.map((c) =>
        createNotification({
          userId: c.id,
          title,
          body: body ?? title,
          type: 'announcement',
        })
      )
    )
  }

  revalidatePath('/admin/announcements')
  revalidatePath('/')
  return { success: true }
}

export async function toggleAnnouncement(id: string, isActive: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('announcements')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/announcements')
  revalidatePath('/')
}

export async function deleteAnnouncement(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/announcements')
  revalidatePath('/')
}
