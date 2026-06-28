'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export type ServiceActionState = { error?: string; success?: string } | undefined

async function assertSuperAdmin(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('role').eq('id', userId).single()
  return data?.role === 'super_admin'
}

async function uploadServiceImage(
  file: File,
  existingUrl?: string | null
): Promise<{ url: string | null; error?: string }> {
  const admin = createAdminClient()

  if (existingUrl) {
    const match = existingUrl.match(/service-images\/(.+)$/)
    if (match?.[1]) {
      await admin.storage.from('service-images').remove([decodeURIComponent(match[1])])
    }
  }

  const ext    = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path   = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage.from('service-images').upload(path, buffer, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  })

  if (error) return { url: null, error: error.message }

  const { data: { publicUrl } } = admin.storage.from('service-images').getPublicUrl(path)
  return { url: publicUrl }
}

// ── Services ─────────────────────────────────────────────────────────────────

export async function createService(
  state: ServiceActionState,
  formData: FormData
): Promise<ServiceActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(user.id))) return { error: 'Unauthorized.' }

  const name          = (formData.get('name') as string).trim()
  const slug          = (formData.get('slug') as string).trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
  const description   = (formData.get('description') as string)?.trim() || null
  const starting_price = parseFloat(formData.get('starting_price') as string)
  const price_note    = (formData.get('price_note') as string)?.trim() || null
  const duration      = (formData.get('duration') as string)?.trim() || null
  const sort_order   = parseInt(formData.get('sort_order') as string) || 0
  const category_id  = (formData.get('category_id') as string) || null

  if (!name)                                       return { error: 'Name is required.' }
  if (!slug)                                       return { error: 'Slug is required.' }
  if (isNaN(starting_price) || starting_price < 0) return { error: 'Enter a valid starting price.' }

  let image_url: string | null = null
  const imageFile = formData.get('image') as File | null
  if (imageFile && imageFile.size > 0) {
    const result = await uploadServiceImage(imageFile)
    if (result.error) return { error: `Image upload failed: ${result.error}` }
    image_url = result.url
  }

  const admin = createAdminClient()
  const { error } = await admin.from('services').insert({
    name, slug, description, starting_price, price_note, duration,
    image_url, sort_order, category_id,
  })

  if (error) {
    return { error: error.code === '23505' ? 'A service with that slug already exists.' : error.message }
  }

  revalidatePath('/admin/services')
  return { success: 'Service created.' }
}

export async function updateService(
  state: ServiceActionState,
  formData: FormData
): Promise<ServiceActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(user.id))) return { error: 'Unauthorized.' }

  const service_id    = formData.get('service_id') as string
  const name          = (formData.get('name') as string).trim()
  const slug          = (formData.get('slug') as string).trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
  const description   = (formData.get('description') as string)?.trim() || null
  const starting_price = parseFloat(formData.get('starting_price') as string)
  const price_note    = (formData.get('price_note') as string)?.trim() || null
  const duration      = (formData.get('duration') as string)?.trim() || null
  const sort_order   = parseInt(formData.get('sort_order') as string) || 0
  const existing_url = (formData.get('existing_image_url') as string) || null
  const category_id  = (formData.get('category_id') as string) || null

  if (!service_id)                                 return { error: 'Missing service ID.' }
  if (!name)                                       return { error: 'Name is required.' }
  if (!slug)                                       return { error: 'Slug is required.' }
  if (isNaN(starting_price) || starting_price < 0) return { error: 'Enter a valid starting price.' }

  let image_url: string | null = existing_url
  const imageFile = formData.get('image') as File | null
  if (imageFile && imageFile.size > 0) {
    const result = await uploadServiceImage(imageFile, existing_url)
    if (result.error) return { error: `Image upload failed: ${result.error}` }
    image_url = result.url
  }

  const admin = createAdminClient()
  const { error } = await admin.from('services').update({
    name, slug, description, starting_price, price_note, duration,
    image_url, sort_order, category_id,
  }).eq('id', service_id)

  if (error) {
    return { error: error.code === '23505' ? 'A service with that slug already exists.' : error.message }
  }

  revalidatePath('/admin/services')
  return { success: 'Service updated.' }
}

export async function toggleServiceStatus(id: string, isActive: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(user.id))) return

  const admin = createAdminClient()
  await admin.from('services').update({ is_active: !isActive }).eq('id', id)
  revalidatePath('/admin/services')
}

export async function deleteService(id: string, imageUrl?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(user.id))) return

  if (imageUrl) {
    const match = imageUrl.match(/service-images\/(.+)$/)
    if (match?.[1]) {
      const admin = createAdminClient()
      await admin.storage.from('service-images').remove([decodeURIComponent(match[1])])
    }
  }

  const admin = createAdminClient()
  await admin.from('services').delete().eq('id', id)
  revalidatePath('/admin/services')
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function createCategory(
  _state: ServiceActionState,
  formData: FormData
): Promise<ServiceActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(user.id))) return { error: 'Unauthorized.' }

  const name       = (formData.get('name') as string).trim()
  const icon       = (formData.get('icon') as string)?.trim() || null
  const sort_order = parseInt(formData.get('sort_order') as string) || 0

  if (!name) return { error: 'Category name is required.' }

  const admin = createAdminClient()
  const { error } = await admin.from('service_categories').insert({ name, icon, sort_order })

  if (error) {
    return { error: error.code === '23505' ? 'A category with that name already exists.' : error.message }
  }

  revalidatePath('/admin/services')
  return { success: 'Category created.' }
}

export async function deleteCategory(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await assertSuperAdmin(user.id))) return

  const admin = createAdminClient()
  // ON DELETE SET NULL cascades to services.category_id automatically
  await admin.from('service_categories').delete().eq('id', id)
  revalidatePath('/admin/services')
}
