// Mirrors the pricing/duration formulas in cleanconnect-mobile's constants/pricing.ts
// so admin-entered bookings estimate the same price a customer would have seen.
// Only these 5 services are priced by property size (sqm); everything else is flat-rate.
export const SQM_PRICED_SLUGS = new Set([
  'general_cleaning',
  'condo_cleaning',
  'office_cleaning',
  'commercial_cleaning',
  'post_construction',
])

// Base rate per sqm-priced service type, matching mobile's BASE_RATE map.
// post_construction has its own rate; the other four sqm services share the general rate.
const SQM_BASE_RATE: Record<string, number> = {
  post_construction: 1500,
}
const DEFAULT_SQM_BASE_RATE = 500
const RATE_PER_SQM = 8

export function serviceNeedsSqm(slug: string | null | undefined): boolean {
  return !!slug && SQM_PRICED_SLUGS.has(slug)
}

/**
 * Estimated price for a booking. For the 5 sqm-priced services this follows
 * mobile's `BASE_RATE + sqm * 8` formula. For everything else it falls back to
 * the service's live `starting_price` (admin-editable, so more accurate than
 * mobile's bundled static price list).
 */
export function estimateBookingPrice(
  slug: string | null | undefined,
  sqm: number,
  fallbackStartingPrice: number
): number {
  if (serviceNeedsSqm(slug)) {
    const base = SQM_BASE_RATE[slug as string] ?? DEFAULT_SQM_BASE_RATE
    return base + sqm * RATE_PER_SQM
  }
  return fallbackStartingPrice
}

export function estimateDurationHours(slug: string | null | undefined, sqm: number): number {
  if (serviceNeedsSqm(slug) && sqm > 0) return Math.max(1, Math.ceil(sqm / 30))
  return 2
}

/**
 * Contextual payment-status label, matching cleanconnect-mobile's
 * app/(customer)/bookings/[id].tsx logic: paid/partial/refunded show as-is;
 * the initial 'unpaid' state reads differently depending on payment method,
 * since digital methods need admin verification of a reference/proof while
 * cash is simply collected on-site.
 */
export function paymentStatusLabel(status: string, method: string): string {
  if (status === 'paid') return 'Paid'
  if (status === 'partial') return 'Partially Paid'
  if (status === 'refunded') return 'Refunded'
  return method === 'cash' ? 'Awaiting Payment' : 'Pending Confirmation'
}
