import Image from 'next/image'
import Link from 'next/link'
import RegisterForm from './register-form'

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image
            src="/Logo.jpg"
            alt="Maid For You Cleaning Services"
            width={130}
            height={40}
            className="h-10 w-auto object-contain"
            priority
          />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create account</h1>
          <p className="text-sm text-gray-500 mt-1">
            Register to access the mobile app when it launches.
          </p>
        </div>

        <RegisterForm />

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-pink-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
