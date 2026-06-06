import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/admin', '/customer'] as const
const AUTH_PATHS = ['/login', '/register'] as const

const ROLE_ROUTES: Record<string, string> = {
  super_admin: '/admin',
  customer: '/customer',
}

const PATH_ROLES: Record<string, string> = {
  '/admin': 'super_admin',
  '/customer': 'customer',
}

export async function proxy(request: NextRequest) {
  // Forward pathname as a request header so server component layouts can read it
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  let response = NextResponse.next({ request: { headers: requestHeaders } })

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
          response = NextResponse.next({ request: { headers: requestHeaders } })
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
  // Also blocks access when no role cookie exists (missing cookie = no permission)
  if (isProtected && session) {
    const role = request.cookies.get('cleanconnect-role')?.value
    const matchedBase = PROTECTED_PATHS.find((p) => path.startsWith(p))

    if (matchedBase && (!role || PATH_ROLES[matchedBase] !== role)) {
      const correctDest = role ? (ROLE_ROUTES[role] ?? '/customer') : '/customer'
      return NextResponse.redirect(new URL(correctDest, request.url))
    }
  }

  // Customer sub-pages are mobile-only — only the root /customer placeholder is rendered.
  if (session && path.startsWith('/customer/')) {
    return NextResponse.redirect(new URL('/customer', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
