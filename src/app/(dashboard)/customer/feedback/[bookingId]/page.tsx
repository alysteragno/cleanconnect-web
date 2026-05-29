import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import FeedbackForm from './feedback-form'

const SERVICE_LABELS: Record<string, string> = {
  general: 'General Cleaning',
  premium_mattress: 'Mattress & Upholstery',
  complete: 'Complete Package',
  disinfection: 'Disinfection',
  post_construction: 'Post-Construction',
}

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params
  const supabase = await createClient()

  const [{ data: booking }, { data: existing }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, service_type, service_date, status, branches (name)')
      .eq('id', bookingId)
      .single(),
    supabase.from('feedback').select('id').eq('booking_id', bookingId).maybeSingle(),
  ])

  if (!booking) notFound()
  if (booking.status !== 'completed') redirect(`/customer/bookings/${bookingId}`)
  if (existing) redirect(`/customer/bookings/${bookingId}`)

  const b = booking as unknown as {
    id: string
    service_type: string
    service_date: string
    branches: { name: string } | null
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link
          href={`/customer/bookings/${bookingId}`}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Back to booking
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Leave Feedback</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {SERVICE_LABELS[b.service_type] ?? 'Cleaning Service'} ·{' '}
          {b.branches?.name} ·{' '}
          {new Date(b.service_date + 'T00:00:00').toLocaleDateString('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <FeedbackForm bookingId={bookingId} />
      </div>
    </div>
  )
}
