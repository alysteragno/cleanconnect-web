import type { NextConfig } from "next";

// Derived from the Supabase project URL so the CSP tracks it automatically
// if the project is ever migrated — no hardcoded project ref to fall out of sync.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : '';

const isDev = process.env.NODE_ENV === 'development';

// Content-Security-Policy — restricts every kind of resource the browser will
// load/execute to an explicit allowlist. Each directive below is scoped to
// exactly what this app uses (verified by auditing every fetch/img/script/
// websocket call site) rather than a broad wildcard.
//
// script-src / style-src need 'unsafe-inline':
//   Next.js App Router injects small inline <script> tags on every page to
//   stream Server Component payloads to the client for hydration — this is
//   framework behavior, not app code, and isn't nonce-free-safe without
//   converting every route (including static marketing pages) to per-request
//   dynamic rendering. style-src needs it because React's `style={{...}}`
//   prop (used e.g. for the Leaflet dispatch map markers) renders as an
//   inline `style="..."` attribute, which CSP always treats as inline
//   regardless of nonces. 'unsafe-eval' is added only in development, where
//   React uses eval() to reconstruct server-side error stacks in the
//   browser — neither React nor Next.js use eval in production.
const cspDirectives = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  `style-src 'self' 'unsafe-inline'`,
  // data:/blob: cover inline SVG icons and any future client-side image
  // previews; the Supabase host serves uploaded cleaner photos, the OSM tile
  // host serves the Leaflet dispatch map tiles.
  `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ''} https://*.tile.openstreetmap.org`,
  // next/font/google self-hosts font files at build time under /_next/static,
  // so fonts are same-origin — no fonts.gstatic.com allowance needed.
  `font-src 'self' data:`,
  // Supabase JS client talks to the project's REST/auth API over https and
  // its Realtime subscriptions (chat, notifications) over wss. Nominatim is
  // used for client-side address geocoding on the cleaner edit form.
  `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ''} https://nominatim.openstreetmap.org`,
  // No <object>/<embed>/Flash-style plugins anywhere in the app.
  `object-src 'none'`,
  // Contact page embeds a Google Maps iframe for the branch location. Without
  // an explicit frame-src, CSP falls back to default-src 'self' and blocks
  // it (Chrome renders "This content is blocked" inside the iframe box).
  `frame-src https://maps.google.com https://www.google.com`,
  // Blocks a <base> tag injection from rebasing relative URLs elsewhere.
  `base-uri 'self'`,
  // Server Actions and native forms only ever submit back to this origin —
  // PayMongo checkout is a plain top-level <a target="_blank"> link, not a
  // form submission, so it isn't affected by this restriction.
  `form-action 'self'`,
  // Modern replacement for X-Frame-Options — belt-and-suspenders with the
  // header below since older browsers only honor the header form.
  `frame-ancestors 'none'`,
  // Rewrites any accidental http:// sub-resource reference to https://.
  `upgrade-insecure-requests`,
];
const contentSecurityPolicy = cspDirectives.join('; ');

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'swpkivehbqugxzsijujq.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        // Applies to every route on every host this deployment serves
        // (maidforyouph.com, www.maidforyouph.com, admin.maidforyouph.com) —
        // Vercel merges these onto the final response regardless of which
        // host handled the request, so the admin subdomain gets identical
        // headers without any extra configuration.
        source: '/(.*)',
        headers: [
          {
            // Tells the browser to only ever connect over HTTPS for this origin
            // (and, via includeSubDomains, every subdomain) for 2 years, and
            // makes it eligible for browser HSTS preload lists. Prevents SSL-
            // stripping downgrade attacks on the very first request.
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            // Stops the browser from MIME-sniffing a response into a different
            // content type than the server declared — closes an XSS vector
            // where an uploaded/served file could otherwise be reinterpreted
            // as executable script or HTML.
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            // Blocks this site from being rendered inside a frame/iframe on
            // any origin (including this app's own other pages), preventing
            // clickjacking attacks against the admin dashboard and payment
            // flows. CSP's frame-ancestors 'none' above does the same job for
            // modern browsers; this covers older ones that ignore CSP.
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            // Sends the full URL as referrer on same-origin navigations, but
            // only the origin (no path/query) when navigating to a different
            // site — keeps booking IDs, tokens, etc. out of third-party
            // referrer logs while still letting analytics attribute traffic.
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // Disables browser APIs this app never calls, so an XSS payload
            // or malicious embedded content couldn't invoke them even if it
            // got past CSP.
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
          },
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
