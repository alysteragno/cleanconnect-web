import Image from 'next/image'
import Link from 'next/link'
import RegisterForm from './register-form'
import { getMarketingHomeHref } from '@/utils/base-path'

export default async function RegisterPage() {
  const homeHref = await getMarketingHomeHref()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <Link href={homeHref}>
        <Image
          src="/Logo.webp"
          alt="Maid For You Cleaning Services"
          width={160}
          height={64}
          className="w-auto object-contain mb-6"
          priority
        />
      </Link>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create account</h1>
          <p className="text-sm text-gray-500 mt-1">Book and manage your cleaning services.</p>
        </div>

        <RegisterForm />

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-pink-600 font-medium hover:text-pink-700 transition-colors">
            Sign in
          </Link>
        </p>
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center">
        Your information is only used to manage your bookings. We will never share it with third parties.
      </p>
    </div>
  )
}
