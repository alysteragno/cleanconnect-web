import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/admin', '/manager', '/cleaner', '/customer'] as const
const AUTH_PATHS = ['/login', '/register'] as const

const ROLE_ROUTES: Record<string, string> = {
  super_admin: '/admin',
  branch_manager: '/manager',
  cleaner: '/cleaner',
  customer: '/customer',
}

const PATH_ROLES: Record<string, string> = {
  '/admin': 'super_admin',
  '/manager': 'branch_manager',
  '/cleaner': 'cleaner',
  '/customer': 'customer',
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Optimistic session check from cookie (no DB call)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const path = request.nextUrl.pathname
  const isProtected = PROTECTED_PATHS.some((p) => path.startsWith(p))
  const isAuthPath = AUTH_PATHS.some((p) => path.startsWith(p))

  // Unauthenticated users cannot access dashboard routes
  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated users visiting auth pages get sent to their dashboard
  if (isAuthPath && session) {
    const role = request.cookies.get('cleanconnect-role')?.value
    const dest = (role && ROLE_ROUTES[role]) ?? '/customer'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Authenticated users accessing the wrong role's dashboard get redirected
  if (isProtected && session) {
    const role = request.cookies.get('cleanconnect-role')?.value
    const matchedBase = PROTECTED_PATHS.find((p) => path.startsWith(p))

    if (matchedBase && role && PATH_ROLES[matchedBase] !== role) {
      const correctDest = ROLE_ROUTES[role] ?? '/customer'
      return NextResponse.redirect(new URL(correctDest, request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
