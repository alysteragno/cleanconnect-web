import { headers } from 'next/headers'
import { MAIN_HOST } from './hosts'

/** True when the current request came in on the admin subdomain (set by proxy.ts). */
export async function isAdminHost(): Promise<boolean> {
  const h = await headers()
  return h.get('x-admin-host') === '1'
}

/**
 * The current request's own "protocol://host[:port]", for passing into
 * resolveRoleHome() as the basis for a cross-host redirect. Reuses the same
 * dev-vs-prod protocol/port logic as getMarketingHomeHref() below.
 */
export async function getCurrentOrigin(): Promise<string> {
  const isLocal = process.env.NODE_ENV !== 'production'
  const protocol = isLocal ? 'http' : 'https'
  const host = (await headers()).get('host') ?? ''
  return `${protocol}://${host}`
}

/**
 * Where the site logo/"back to home" link should point. On the admin
 * subdomain, "/" is the (hidden) admin dashboard root, not the marketing
 * site — so the logo needs an explicit cross-host link back to the main
 * domain there instead of a relative "/".
 *
 * Reuses the current request's protocol/port rather than hardcoding https,
 * so this also works in local dev (http://localhost:3000) and not just
 * production (https://maidforyouph.com, no explicit port).
 */
export async function getMarketingHomeHref(): Promise<string> {
  if (!(await isAdminHost())) return '/'

  const origin = new URL(await getCurrentOrigin())
  const port = origin.port ? `:${origin.port}` : ''
  return `${origin.protocol}//${MAIN_HOST}${port}`
}

/**
 * '' on the admin subdomain (the /admin segment is implicit and invisible there),
 * '/admin' everywhere else. Use to build every admin-section href/redirect:
 * `${basePath}/bookings`, or `basePath || '/'` for the dashboard root.
 */
export async function getBasePath(): Promise<string> {
  return (await isAdminHost()) ? '' : '/admin'
}
