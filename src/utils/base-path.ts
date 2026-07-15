import { headers } from 'next/headers'

/** True when the current request came in on the admin subdomain (set by proxy.ts). */
export async function isAdminHost(): Promise<boolean> {
  const h = await headers()
  return h.get('x-admin-host') === '1'
}

/**
 * '' on the admin subdomain (the /admin segment is implicit and invisible there),
 * '/admin' everywhere else. Use to build every admin-section href/redirect:
 * `${basePath}/bookings`, or `basePath || '/'` for the dashboard root.
 */
export async function getBasePath(): Promise<string> {
  return (await isAdminHost()) ? '' : '/admin'
}
