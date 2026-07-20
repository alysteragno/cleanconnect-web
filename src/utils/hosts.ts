// Pure constants/helpers shared by proxy.ts (Edge, no next/headers) and
// server actions/components (which layer next/headers on top via base-path.ts).

export const ADMIN_HOST = process.env.NEXT_PUBLIC_ADMIN_HOST ?? 'admin.maidforyouph.com'
export const MAIN_HOST = process.env.NEXT_PUBLIC_MAIN_HOST ?? 'maidforyouph.com'

export const ROLE_ROUTES: Record<string, string> = {
  super_admin: '/admin',
  customer: '/customer',
}

/**
 * Where a role should land after auth, given the host the request came in on.
 * The admin subdomain never shows the `/admin` segment, so the super_admin
 * destination becomes the (invisible) root there. Any other role landing on
 * the admin subdomain doesn't belong on it at all, so it's sent cross-host
 * to the main domain instead of being rewritten into a nonsensical /admin/* path.
 *
 * `currentOrigin` is the requesting host's own "protocol://host[:port]" (e.g.
 * `request.url` in proxy.ts, or built from headers() in a server action) — a
 * cross-host destination reuses its protocol/port instead of hardcoding
 * https, so this also works in local dev (http://localhost:3000) and not
 * just production (https://maidforyouph.com, no explicit port).
 */
export function resolveRoleHome(role: string, onAdminHost: boolean, currentOrigin: string): string {
  const dest = ROLE_ROUTES[role] ?? '/customer'
  const origin = new URL(currentOrigin)
  const withHost = (host: string) => `${origin.protocol}//${host}${origin.port ? `:${origin.port}` : ''}`

  if (dest === '/admin') return onAdminHost ? '/' : withHost(ADMIN_HOST)
  return onAdminHost ? `${withHost(MAIN_HOST)}${dest}` : dest
}
