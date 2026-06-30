'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { createNotification } from './notifications'

export type ComplaintState = { error?: string } | undefined

export async function fileComplaint(
  state: ComplaintState,
  formData: FormData
): Promise<ComplaintState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const subject = (formData.get('subject') as string).trim()
  const booking_id = (formData.get('booking_id') as string) || null
  const message = (formData.get('message') as string).trim()

  if (!subject) return { error: 'Subject is required.' }
  if (!message) return { error: 'Please describe your concern.' }

  const admin = createAdminClient()

  const { data: complaint, error: cErr } = await admin
    .from('complaints')
    .insert({ customer_id: user.id, booking_id, subject })
    .select('id')
    .single()

  if (cErr || !complaint) return { error: 'Failed to file complaint. Please try again.' }

  await admin.from('complaint_messages').insert({
    complaint_id: complaint.id,
    sender_id: user.id,
    message,
  })

  const { data: admins } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'super_admin')

  for (const a of admins ?? []) {
    await createNotification({
      userId: a.id,
      title: 'New Complaint Filed',
      body: `"${subject}" — a customer needs assistance.`,
      type: 'complaint_new',
      complaintId: complaint.id,
    })
  }

  revalidatePath('/customer/complaints')
  redirect(`/customer/complaints/${complaint.id}`)
}

export async function sendComplaintMessage(
  complaintId: string,
  message: string
): Promise<{ error?: string; message?: { id: string; message: string; created_at: string; sender_id: string } } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const isStaff = profile?.role === 'super_admin'
  const table   = isStaff ? 'staff_complaint_messages' : 'complaint_messages'

  const admin = createAdminClient()

  const { error } = await admin
    .from(table)
    .insert({ complaint_id: complaintId, sender_id: user.id, message })

  if (error) return { error: error.message }

  // Fetch the just-inserted row so the client can optimistically update without a reload
  const { data: newMsg } = await admin
    .from(table)
    .select('id, message, created_at, sender_id')
    .eq('complaint_id', complaintId)
    .eq('sender_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: complaint } = await admin
    .from('complaints')
    .select('customer_id, subject')
    .eq('id', complaintId)
    .single()

  if (complaint) {
    if (isStaff) {
      await createNotification({
        userId: complaint.customer_id,
        title: 'Support Replied',
        body: `New reply on your complaint: "${complaint.subject}".`,
        type: 'complaint_reply',
        complaintId,
      })
    } else {
      const { data: admins } = await admin.from('profiles').select('id').eq('role', 'super_admin')
      for (const a of admins ?? []) {
        await createNotification({
          userId: a.id,
          title: 'Customer Replied',
          body: `Reply on complaint: "${complaint.subject}".`,
          type: 'complaint_reply',
          complaintId,
        })
      }
    }
  }

  return { message: newMsg ?? undefined }
}

export async function updateComplaintStatus(
  complaintId: string,
  status: string
): Promise<{ error?: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('complaints')
    .update({ status })
    .eq('id', complaintId)

  if (error) return { error: error.message }

  revalidatePath('/admin/complaints')
  revalidatePath(`/admin/complaints/${complaintId}`)
}
