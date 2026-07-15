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
 */
export function resolveRoleHome(role: string, onAdminHost: boolean): string {
  const dest = ROLE_ROUTES[role] ?? '/customer'
  if (dest === '/admin') return onAdminHost ? '/' : '/admin'
  return onAdminHost ? `https://${MAIN_HOST}${dest}` : dest
}
