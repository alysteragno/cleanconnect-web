import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { getBasePath } from '@/utils/base-path'
import CustomerToggleForm from './customer-toggle-form'
import ConvertToCleanerForm from './convert-to-cleaner-form'
import DeleteCustomerButton from './delete-customer-button'
import { IconHeadset } from '@/components/icons'
import { Pagination } from '@/components/dashboard/pagination'
import { resolvePage } from '@/utils/pagination'

const PAGE_SIZE = 10

type Customer = {
  id: string
  full_name: string
  phone: string | null
  is_active: boolean
  created_at: string
}

type Booking = {
  id: string
  service_date: string
  service_time: string
  service_name: string | null
  base_price: number
  status: string
  payment_status: string
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-pink-50 text-pink-700 border-pink-200',
  in_progress: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { id } = await params
  const { page: rawPage } = await searchParams
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()
  const { data: userProfile } = await authClient.from('profiles').select('role').eq('id', user.id).single()
  if (userProfile?.role !== 'super_admin') notFound()

  const basePath = await getBasePath()
  const supabase = createAdminClient()

  const [{ data: customer }, { data: statsRows }, { count: totalBookings }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, phone, is_active, created_at')
      .eq('id', id)
      .eq('role', 'customer')
      .single(),
    // Lightweight full-history fetch (status + price only) so the summary
    // stats below cover every booking, not just the current page.
    supabase
      .from('bookings')
      .select('status, base_price')
      .eq('customer_id', id),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', id),
  ])

  if (!customer) notFound()

  const c = customer as unknown as Customer
  const stats = statsRows ?? []
  const completedCount = stats.filter((b) => b.status === 'completed').length
  const totalSpent = stats
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + Number(b.base_price), 0)

  const total = totalBookings ?? 0
  const page = resolvePage(rawPage, total, PAGE_SIZE)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, service_date, service_time, service_name, base_price, status, payment_status')
    .eq('customer_id', id)
    .order('service_date', { ascending: false })
    .range(from, to)

  const bookingList = (bookings ?? []) as unknown as Booking[]

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`${basePath}/customers`} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Customers
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Customer Profile</h1>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-4 pb-5 border-b border-gray-100">
          <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-lg font-bold shrink-0">
            {c.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-gray-900">{c.full_name}</p>
            <p className="text-xs text-gray-500">{c.phone ?? 'No phone on file'}</p>
          </div>
          <Link
            href={`${basePath}/support/${c.id}`}
            className="flex items-center gap-1.5 px-3 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 transition-colors shrink-0"
          >
            <IconHeadset />
            Message
          </Link>
        </div>

        <div className="divide-y divide-gray-100">
          <Row label="Member since" value={formatDate(c.created_at.slice(0, 10))} />
          <Row label="Total bookings" value={String(total)} />
          <Row label="Completed bookings" value={String(completedCount)} />
          <Row label="Total spent" value={`₱${totalSpent.toLocaleString()}`} />
        </div>

        {/* Account status toggle */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Account Status</p>
          <CustomerToggleForm customerId={c.id} isActive={c.is_active} />
        </div>

        {/* Convert to cleaner */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Role</p>
          <ConvertToCleanerForm customerId={c.id} fullName={c.full_name} defaultPhone={c.phone} />
        </div>

        {/* Delete account permanently */}
        <div>
          <DeleteCustomerButton customerId={c.id} />
        </div>
      </div>

      {/* Booking history */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">Booking History</p>
          <span className="text-xs text-gray-400">{total}</span>
        </div>
        {bookingList.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No bookings yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {bookingList.map((b) => (
              <Link
                key={b.id}
                href={`${basePath}/bookings/${b.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {b.service_name ?? 'Cleaning'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(b.service_date)} at {formatTime(b.service_time)}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4 space-y-1">
                  <p className="text-sm font-bold text-gray-900">₱{Number(b.base_price).toLocaleString()}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_STYLES[b.status] ?? ''}`}>
                    {b.status.replace('_', ' ')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
        <Pagination totalItems={total} pageSize={PAGE_SIZE} />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 gap-4">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  )
}
