import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_HOST, ROLE_ROUTES, resolveRoleHome } from './utils/hosts'

const PROTECTED_PATHS = ['/admin', '/customer'] as const
const AUTH_PATHS = ['/login', '/register'] as const

// Paths that render the same on every host and must NOT be rewritten under /admin
// on the admin subdomain (there's no /admin/login page — auth is shared).
const ADMIN_HOST_PASSTHROUGH = ['/login', '/register', '/forgot-password', '/reset-password'] as const

const PATH_ROLES: Record<string, string> = {
  '/admin': 'super_admin',
  '/customer': 'customer',
}

export async function proxy(request: NextRequest) {
  const hostname = (request.headers.get('host') ?? request.nextUrl.hostname).split(':')[0]
  const onAdminHost = hostname === ADMIN_HOST

  const rawPathname = request.nextUrl.pathname

  // Canonical (backing) path this request maps to. On the admin subdomain, every
  // path except the shared auth pages is transparently prefixed with /admin so the
  // rest of this function — and the rest of the app — can keep reasoning in terms
  // of the real route tree, while the browser never sees the /admin segment.
  let canonicalPathname = rawPathname
  let rewriteTarget: string | null = null

  if (onAdminHost) {
    const isPassthrough = ADMIN_HOST_PASSTHROUGH.some(
      (p) => rawPathname === p || rawPathname.startsWith(`${p}/`)
    )
    if (!isPassthrough && !rawPathname.startsWith('/admin')) {
      canonicalPathname = rawPathname === '/' ? '/admin' : `/admin${rawPathname}`
      rewriteTarget = canonicalPathname
    }
  }

  // Forward pathname as a request header so server component layouts can read it
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', canonicalPathname)
  if (onAdminHost) requestHeaders.set('x-admin-host', '1')

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

  const path = canonicalPathname
  const isProtected = PROTECTED_PATHS.some((p) => path.startsWith(p))
  const isAuthPath = AUTH_PATHS.some((p) => path.startsWith(p))

  function redirectTo(dest: string) {
    // dest may be an absolute cross-host URL (from resolveRoleHome) or a same-host path
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Unauthenticated users cannot access dashboard routes
  if (isProtected && !session) {
    return redirectTo('/login')
  }

  // Authenticated users visiting auth pages get sent to their dashboard.
  // Without a role cookie we can't pick a destination that won't immediately
  // bounce back here — let the auth page render instead of looping.
  if (isAuthPath && session) {
    const role = request.cookies.get('cleanconnect-role')?.value
    if (role) {
      return redirectTo(resolveRoleHome(role, onAdminHost))
    }
  }

  // Authenticated users accessing the wrong role's dashboard get redirected
  // Missing role cookie means we can't determine the correct destination —
  // send to /login rather than another protected path, which would loop.
  if (isProtected && session) {
    const role = request.cookies.get('cleanconnect-role')?.value
    const matchedBase = PROTECTED_PATHS.find((p) => path.startsWith(p))

    if (matchedBase && !role) {
      return redirectTo('/login')
    }

    if (matchedBase && role && PATH_ROLES[matchedBase] !== role) {
      if (onAdminHost) {
        // This host only ever serves /admin — any other role has no business here.
        return redirectTo(resolveRoleHome(role, true))
      }
      const correctDest = ROLE_ROUTES[role] ?? '/customer'
      if (correctDest !== matchedBase) {
        return redirectTo(correctDest)
      }
    }
  }

  // Customer sub-pages are mobile-only — only the root /customer placeholder is rendered.
  if (session && path.startsWith('/customer/')) {
    return redirectTo('/customer')
  }

  if (rewriteTarget) {
    const url = new URL(rewriteTarget + request.nextUrl.search, request.url)
    const rewritten = NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    response.cookies.getAll().forEach((c) => rewritten.cookies.set(c))
    rewritten.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return rewritten
  }

  if (onAdminHost) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  return response
}

export const config = {
  matcher: [
    // Exclude API routes, Next internals, and any request for a static file
    // (images, fonts, favicon.ico, robots.txt, sitemap.xml, etc — anything with an extension).
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
}
