import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import { listCustomers } from '@/app/actions/admin'
import BookingForm from './booking-form'

export default async function AdminNewBookingPage() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const basePath = await getBasePath()
  const adminClient = createAdminClient()
  const { data: services } = await adminClient
    .from('services')
    .select('id, name, slug, starting_price, price_note, duration')
    .eq('is_active', true)
    .order('sort_order')
  const customers = await listCustomers()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={`${basePath}/bookings`}
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M10 3L5 8l5 5" />
          </svg>
          Bookings
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">New Booking</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create a booking on behalf of a customer.</p>
      </div>

      <BookingForm
        services={(services ?? []) as {
          id: string; name: string; slug: string
          starting_price: number; price_note: string | null; duration: string | null
        }[]}
        customers={customers}
      />
    </div>
  )
}
