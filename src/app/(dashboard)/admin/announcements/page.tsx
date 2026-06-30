import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { toggleAnnouncement, deleteAnnouncement } from '@/app/actions/announcements'
import AnnouncementCreateForm from './create-form'

type Announcement = {
  id: string
  title: string
  body: string | null
  is_active: boolean
  created_at: string
  created_by: string | null
  poster_name: string
}

export default async function AdminAnnouncementsPage() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') notFound()

  const admin = createAdminClient()

  const { data: rows } = await admin
    .from('announcements')
    .select('id, title, body, is_active, created_at, created_by')
    .order('created_at', { ascending: false })

  const posterIds = [...new Set((rows ?? []).filter((r) => r.created_by).map((r) => r.created_by as string))]
  let posterMap: Record<string, string> = {}
  if (posterIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', posterIds)
    posterMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))
  }

  const list: Announcement[] = (rows ?? []).map((r) => ({
    ...r,
    poster_name: r.created_by ? (posterMap[r.created_by] ?? 'Admin') : 'Admin',
  }))

  const activeCount = list.filter((a) => a.is_active).length

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Dashboard</Link>
        <div className="flex items-baseline justify-between mt-2">
          <h1 className="text-xl font-bold text-gray-900">Announcements</h1>
          <span className="text-sm text-gray-400">{activeCount} active</span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">Active announcements appear on the public homepage.</p>
      </div>

      <AnnouncementCreateForm />

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">All Announcements</p>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No announcements yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.map((a) => (
              <div key={a.id} className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-medium text-gray-900">{a.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      a.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-50 text-gray-400 border-gray-200'
                    }`}>
                      {a.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                  {a.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(a.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}
                    <span className="ml-1.5">· Posted by <span className="font-medium text-gray-500">{a.poster_name}</span></span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <form action={async () => { 'use server'; await toggleAnnouncement(a.id, !a.is_active) }}>
                    <button
                      type="submit"
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 transition-colors font-medium"
                    >
                      {a.is_active ? 'Hide' : 'Show'}
                    </button>
                  </form>
                  <form action={async () => { 'use server'; await deleteAnnouncement(a.id) }}>
                    <button
                      type="submit"
                      className="text-xs px-3 py-1.5 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors font-medium"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
