import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/utils/supabase/server'
import { toggleServiceStatus, deleteService, createCategory, deleteCategory } from '@/app/actions/services'
import ServiceForm from './service-form'
import { IconLayers, IconClock, IconX } from '@/components/icons'
import CategoryForm from './category-form'

type Service = {
  id: string
  name: string
  slug: string
  description: string | null
  starting_price: number
  price_note: string | null
  duration: string | null
  image_url: string | null
  is_active: boolean
  sort_order: number
  category_id: string | null
  created_at: string
}

type Category = {
  id: string
  name: string
  icon: string | null
  sort_order: number
}

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const { edit: editId } = await searchParams

  const admin = createAdminClient()
  const [{ data: servicesData }, { data: categoryData }] = await Promise.all([
    admin.from('services').select('*').order('sort_order').order('created_at'),
    admin.from('service_categories').select('*').order('sort_order'),
  ])

  const services   = (servicesData ?? [])  as Service[]
  const categories = (categoryData ?? [])  as Category[]

  const editService  = editId ? services.find(s => s.id === editId) : undefined
  const activeCount  = services.filter(s => s.is_active).length

  // Group services by category
  const grouped = new Map<string, { category: Category | null; services: Service[] }>()
  for (const cat of categories) {
    grouped.set(cat.id, { category: cat, services: [] })
  }
  grouped.set('__none__', { category: null, services: [] })

  for (const s of services) {
    const key = s.category_id && grouped.has(s.category_id) ? s.category_id : '__none__'
    grouped.get(key)!.services.push(s)
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Dashboard
        </Link>
        <div className="flex items-baseline justify-between mt-2">
          <h1 className="text-xl font-bold text-gray-900">Services</h1>
          <span className="text-sm text-gray-400">{activeCount} active · {services.length} total</span>
        </div>
      </div>

      {/* Create / Edit form */}
      <ServiceForm key={editId ?? 'create'} service={editService} categories={categories} />

      {/* Services grouped by category */}
      {services.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 text-center py-16">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <IconLayers className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-400 font-medium">No services yet.</p>
          <p className="text-xs text-gray-300 mt-1">Create your first service above.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {[...grouped.entries()]
            .filter(([, g]) => g.services.length > 0)
            .map(([key, g]) => (
              <div key={key}>
                {/* Category heading */}
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    {g.category?.name ?? 'Uncategorized'}
                  </h2>
                  {g.category?.icon && (
                    <span className="text-xs text-gray-400 font-mono">({g.category.icon})</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {g.services.map(s => (
                    <ServiceCard key={s.id} service={s} editId={editId} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Category management */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-700">Manage Categories</p>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                {cat.icon && <span className="text-xs font-mono text-gray-400">{cat.icon}</span>}
                <span className="text-sm text-gray-700 font-medium">{cat.name}</span>
                <form action={async () => { 'use server'; await deleteCategory(cat.id) }}>
                  <button type="submit" className="ml-1 text-gray-300 hover:text-red-400 transition-colors">
                    <IconX />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        <CategoryForm />
      </div>

    </div>
  )
}

// ── Service card ─────────────────────────────────────────────────────────────

function ServiceCard({ service: s, editId }: { service: Service; editId?: string }) {
  const isBeingEdited = editId === s.id
  return (
    <div
      className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col transition-all duration-200 ${
        isBeingEdited
          ? 'border-pink-300 ring-2 ring-pink-100'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
    >
      {/* Image or placeholder */}
      <div className="relative h-40 bg-gray-100 shrink-0">
        {s.image_url ? (
          <Image src={s.image_url} alt={s.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <IconLayers className="text-gray-300" />
          </div>
        )}
        <span className={`absolute top-2.5 left-2.5 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
          s.is_active
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-gray-50 text-gray-400 border-gray-200'
        }`}>
          {s.is_active ? 'Active' : 'Hidden'}
        </span>
        <span className="absolute top-2.5 right-2.5 text-[10px] px-2 py-0.5 bg-white/90 backdrop-blur rounded-full border border-gray-200 font-mono text-gray-500">
          {s.slug}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-gray-900 leading-snug">{s.name}</p>
        {s.description && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{s.description}</p>
        )}
        <div className="mt-auto pt-2 flex items-baseline gap-2">
          <p className="text-base font-bold text-pink-600">
            ₱{Number(s.starting_price).toLocaleString()}
          </p>
          {s.price_note && <span className="text-xs text-gray-400">{s.price_note}</span>}
        </div>
        {s.duration && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <IconClock className="shrink-0" />
            {s.duration}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 pt-3 border-t border-gray-100 flex gap-2">
        <Link
          href={isBeingEdited ? '/admin/services' : `/admin/services?edit=${s.id}`}
          className={`flex-1 text-center text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            isBeingEdited
              ? 'bg-pink-50 border border-pink-200 text-pink-700'
              : 'border border-gray-300 text-gray-600 hover:border-gray-400'
          }`}
        >
          {isBeingEdited ? 'Editing…' : 'Edit'}
        </Link>
        <form action={async () => { 'use server'; await toggleServiceStatus(s.id, s.is_active) }}>
          <button type="submit" className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 transition-colors font-medium">
            {s.is_active ? 'Hide' : 'Show'}
          </button>
        </form>
        <form action={async () => { 'use server'; await deleteService(s.id, s.image_url) }}>
          <button type="submit" className="text-xs px-3 py-1.5 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors font-medium">
            Delete
          </button>
        </form>
      </div>
    </div>
  )
}
