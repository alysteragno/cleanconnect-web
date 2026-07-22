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

const RATE_PER_SQM = 8

export function serviceNeedsSqm(slug: string | null | undefined): boolean {
  return !!slug && SQM_PRICED_SLUGS.has(slug)
}

/**
 * Estimated price for a booking. For the 5 sqm-priced services this is the
 * service's live `starting_price` (admin-editable, e.g. ₱1,200 for condo
 * cleaning) plus `sqm * 8`. Using the live starting_price as the base — instead
 * of a hardcoded per-slug rate — keeps this in sync with whatever admins set
 * on the services page, rather than drifting from it. Non-sqm services just
 * use the starting_price directly.
 */
export function estimateBookingPrice(
  slug: string | null | undefined,
  sqm: number,
  fallbackStartingPrice: number
): number {
  if (serviceNeedsSqm(slug)) {
    return fallbackStartingPrice + sqm * RATE_PER_SQM
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
