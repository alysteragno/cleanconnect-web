import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import BookingStepper from './booking-stepper'

export default async function BookPage() {
  const supabase = await createClient()
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, region')
    .order('name')

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/customer" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Book a Service</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fill in the details below to schedule your cleaning.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <BookingStepper branches={branches ?? []} />
      </div>
    </div>
  )
}
