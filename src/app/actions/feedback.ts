'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export type FeedbackState = { error: string } | undefined

export async function submitFeedback(
  state: FeedbackState,
  formData: FormData
): Promise<FeedbackState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be logged in.' }

  const booking_id = formData.get('booking_id') as string
  const ratingRaw = formData.get('rating') as string
  const comment = (formData.get('comment') as string).trim() || null

  const rating = parseInt(ratingRaw)
  if (!booking_id) return { error: 'Invalid booking.' }
  if (isNaN(rating) || rating < 1 || rating > 5) return { error: 'Please select a rating.' }

  // Verify the booking is completed and belongs to this customer
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, customer_id')
    .eq('id', booking_id)
    .single()

  if (!booking) return { error: 'Booking not found.' }
  if (booking.customer_id !== user.id) return { error: 'Not authorized.' }
  if (booking.status !== 'completed') return { error: 'Feedback can only be submitted for completed bookings.' }

  const { error } = await supabase.from('feedback').insert({
    booking_id,
    customer_id: user.id,
    rating,
    comment,
  })

  if (error) {
    if (error.code === '23505') return { error: 'You have already submitted feedback for this booking.' }
    return { error: error.message }
  }

  revalidatePath(`/customer/bookings/${booking_id}`)
  redirect(`/customer/bookings/${booking_id}`)
}
