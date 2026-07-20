import Image from 'next/image'
import Link from 'next/link'
import ForgotForm from './forgot-form'
import { getMarketingHomeHref } from '@/utils/base-path'

export default async function ForgotPasswordPage() {
  const homeHref = await getMarketingHomeHref()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-pink-600 flex-col justify-between p-12">
        <div>
          <p className="text-pink-100 text-sm font-medium uppercase tracking-widest mb-4">
            Maid For You
          </p>
          <h2 className="text-white text-3xl font-bold leading-snug">
            Professional cleaning operations,
            <br />
            managed in one place.
          </h2>
          <p className="text-pink-200 text-sm mt-4 leading-relaxed">
            Maid For You Cleaning Services — serving Metro Manila since 2021.
          </p>
        </div>
        <p className="text-pink-300 text-xs">
          &copy; {new Date().getFullYear()} Maid For You Cleaning Services
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex justify-center mb-8">
            <Link href={homeHref}>
              <Image
                src="/Logo.webp"
                alt="Maid For You Cleaning Services"
                width={150}
                height={60}
                className="w-auto object-contain"
                priority
              />
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Forgot password?</h1>
            <p className="text-sm text-gray-500 mt-1">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          <ForgotForm />
        </div>
      </div>
    </div>
  )
}
