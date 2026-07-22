// Shared between the manual-booking client form and its server action so the
// two can never drift — the server re-validates every one of these against
// the exact same list the client renders as a dropdown, instead of trusting
// whatever a direct (non-UI) request claims.

export const SPACE_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'condo',       label: 'Condo' },
  { value: 'office',      label: 'Office' },
  { value: 'commercial',  label: 'Commercial' },
] as const

export const METRO_MANILA_CITIES = [
  'Caloocan', 'Las Piñas', 'Makati', 'Malabon', 'Mandaluyong', 'Manila',
  'Marikina', 'Muntinlupa', 'Navotas', 'Parañaque', 'Pasay', 'Pasig',
  'Pateros', 'Quezon City', 'San Juan', 'Taguig', 'Valenzuela',
] as const

export const PAYMENT_METHODS = [
  { value: 'cash',       label: 'Cash' },
  { value: 'gcash',      label: 'Online Payment (QRPh)' },
  { value: 'bank_check', label: 'Bank Check' },
] as const
