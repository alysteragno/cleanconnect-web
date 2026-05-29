import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

type Cleaner = {
  id: string
  full_name: string
  phone: string | null
  created_at: string
}

type CleanerWithStats = Cleaner & {
  active: number
  completed: number
}

export default async function ManagerCleanersPage() {
  const supabase = await createClient()

  const { data: cleaners } = await supabase
    .from('profiles')
    .select('id, full_name, phone, created_at')
    .eq('role', 'cleaner')
    .order('full_name')

  const list = (cleaners ?? []) as Cleaner[]

  // Fetch assignment counts per cleaner in parallel
  const withStats: CleanerWithStats[] = await Promise.all(
    list.map(async (c) => {
      const [{ count: active }, { count: completed }] = await Promise.all([
        supabase
          .from('cleaner_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('cleaner_id', c.id)
          .eq('status', 'accepted'),
        supabase
          .from('cleaner_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('cleaner_id', c.id)
          .eq('status', 'completed'),
      ])
      return { ...c, active: active ?? 0, completed: completed ?? 0 }
    })
  )

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/manager" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Dashboard
        </Link>
        <div className="flex items-baseline justify-between mt-2">
          <h1 className="text-xl font-bold text-gray-900">Branch Cleaners</h1>
          <span className="text-sm text-gray-400">{withStats.length} cleaner{withStats.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {withStats.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">
            No cleaners assigned to this branch yet.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {withStats.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                    {c.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                    <p className="text-xs text-gray-400">{c.phone ?? 'No phone'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-sm font-bold text-purple-600">{c.active}</p>
                    <p className="text-xs text-gray-400">Active</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-600">{c.completed}</p>
                    <p className="text-xs text-gray-400">Done</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
