import Image from 'next/image'
import LoginForm from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>
}) {
  const { registered } = await searchParams

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-pink-600 flex-col justify-between p-12">
        <Image
          src="/Logo.jpg"
          alt="Maid For You Cleaning Services"
          width={140}
          height={44}
          className="h-11 w-auto object-contain brightness-0 invert"
          priority
        />
        <div>
          <p className="text-pink-100 text-sm font-medium uppercase tracking-widest mb-4">
            Admin Portal
          </p>
          <h2 className="text-white text-3xl font-bold leading-snug">
            Professional cleaning operations,
            <br />
            managed in one place.
          </h2>
          <p className="text-pink-200 text-sm mt-4 leading-relaxed">
            Maid For You Cleaning Services — serving Metro Manila since 2016.
          </p>
        </div>
        <p className="text-pink-300 text-xs">
          &copy; {new Date().getFullYear()} Maid For You Cleaning Services
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <Image
              src="/Logo.jpg"
              alt="Maid For You Cleaning Services"
              width={130}
              height={40}
              className="h-10 w-auto object-contain"
              priority
            />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sign in</h1>
            <p className="text-sm text-gray-500 mt-1">Admin and staff access only.</p>
          </div>

          {registered && (
            <div className="mb-5 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              Account created. You can now sign in.
            </div>
          )}

          <LoginForm />
        </div>
      </div>
    </div>
  )
}
