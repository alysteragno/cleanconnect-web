import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'

type Customer = {
  id: string
  full_name: string
  phone: string | null
  is_active: boolean
  created_at: string
}

export default async function AdminCustomersPage() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const supabase = createAdminClient()

  const { data: customers } = await supabase
    .from('profiles')
    .select('id, full_name, phone, is_active, created_at')
    .eq('role', 'customer')
    .order('full_name')

  const list = (customers ?? []) as unknown as Customer[]
  const active = list.filter((c) => c.is_active)
  const inactive = list.filter((c) => !c.is_active)

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Dashboard</Link>
        <div className="flex items-baseline justify-between mt-2">
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <span className="text-sm text-gray-400">{list.length} total</span>
        </div>
      </div>

      <CustomerSection title="Active" customers={active} />
      {inactive.length > 0 && <CustomerSection title="Deactivated" customers={inactive} dimmed />}
    </div>
  )
}

function CustomerSection({
  title,
  customers,
  dimmed = false,
}: {
  title: string
  customers: Customer[]
  dimmed?: boolean
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-200">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <span className="text-xs text-gray-400">{customers.length}</span>
      </div>
      {customers.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">None.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {customers.map((c) => (
            <Link
              key={c.id}
              href={`/admin/customers/${c.id}`}
              className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group ${dimmed ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  {c.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                  <p className="text-xs text-gray-400">{c.phone ?? 'No phone'}</p>
                </div>
              </div>
              <p className="text-xs text-pink-600 group-hover:underline">View →</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
