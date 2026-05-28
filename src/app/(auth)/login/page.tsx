import LoginForm from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>
}) {
  const { registered } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to CleanConnect</p>
        </div>

        {registered && (
          <div className="mb-6 p-3 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100">
            Account created successfully. You can now sign in.
          </div>
        )}

        <LoginForm />
      </div>
    </div>
  )
}
