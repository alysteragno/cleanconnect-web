// ── Shared input sanitization & validation ─────────────────────────────────
// Single source of truth for the character rules used across admin forms
// (manual booking, new customer, cleaner accounts). Server actions import
// the *_RE regexes below to do the authoritative check; client components
// import the sanitize* functions to strip disallowed characters as the user
// types, so what the browser shows already matches what the server accepts.

export const PH_MOBILE_RE = /^09\d{9}$/
// Deliberately narrower than the full WHATWG/HTML5 email grammar: local part
// is restricted to letters, digits, and . _ - + (no <, >, spaces, or the
// other RFC-legal-but-rarely-used symbols like ! # $ % & ' * = ? ^ ` { | } ~).
// Domain must be dot-separated labels that each start/end alphanumeric (so
// "-bad.com" and "x..com" are rejected) with a required TLD — "user@localhost"
// doesn't validate.
export const EMAIL_RE = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
/** Letters (incl. accented PH names), digits, spaces, and common address punctuation only — no <, @, %, or other markup/injection characters. */
export const ADDRESS_TEXT_RE = /^[a-zA-Z0-9À-ÿ.,'#\-\/() ]+$/
/** Letters (incl. accented PH names), spaces, periods, apostrophes, and hyphens only. */
export const NAME_TEXT_RE = /^[a-zA-ZÀ-ÿ' .\-]+$/
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const TIME_RE = /^\d{2}:\d{2}$/
/** Roughly the Philippines' bounding box — cheap sanity check on submitted coordinates. */
export const PH_LAT_RANGE = [4, 21.5] as const
export const PH_LNG_RANGE = [116, 127] as const

// Built from char codes rather than a \x00-\x1F regex escape to avoid
// embedding literal control bytes in this source file.
const CONTROL_CHAR_RE = new RegExp(
  '[' + Array.from({ length: 33 }, (_, i) => String.fromCharCode(i === 32 ? 127 : i)).join('') + ']',
  'g'
)
/** Trim, strip control characters, collapse whitespace, and cap length. */
export function cleanText(value: FormDataEntryValue | null, maxLength: number): string {
  return (typeof value === 'string' ? value : '')
    .replace(CONTROL_CHAR_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

export function ageInYears(dob: Date): number {
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const monthDiff = now.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--
  return age
}

// Every character EMAIL_RE allows anywhere in an address (local part's
// charset is a superset of the domain's), used below to point out exactly
// which character broke validation instead of just saying "invalid".
const EMAIL_ALLOWED_CHAR_RE = /[a-zA-Z0-9._+@-]/

/**
 * Diagnoses exactly why an email failed EMAIL_RE instead of a blanket
 * "invalid email" — checked in order from "most likely what the admin
 * actually typed wrong" (a stray character like < or a missing @) down to
 * domain formatting edge cases.
 */
export function describeEmailError(email: string): string {
  if (!email) return 'Email is required.'
  if (/\s/.test(email)) return 'Email cannot contain spaces.'

  const badChars = [...new Set([...email].filter((c) => !EMAIL_ALLOWED_CHAR_RE.test(c)))]
  if (badChars.length > 0) {
    return `Email contains characters that aren't allowed: ${badChars.join(' ')}`
  }

  const atCount = (email.match(/@/g) ?? []).length
  if (atCount === 0) return 'Email must contain an @ symbol, e.g. name@example.com.'
  if (atCount > 1) return 'Email must contain only one @ symbol.'

  const [local, domain] = email.split('@')
  if (!local) return 'Enter the part of the email before the @ symbol.'
  if (!domain) return 'Enter a domain after the @ symbol, e.g. example.com.'
  if (!domain.includes('.')) return 'Domain must include an extension, e.g. .com.'
  if (/^[.-]|[.-]$|\.\.|-\.|\.-/.test(domain)) return 'Enter a valid domain, e.g. example.com.'

  return 'Enter a valid email address, e.g. name@example.com.'
}

// ── Client-side keystroke sanitizers ────────────────────────────────────────
// Strip disallowed characters as the user types, mirroring the *_RE allow-lists
// above exactly so nothing that would fail server-side validation can even be
// typed or pasted in. These are pure functions safe to import into client
// components — the final value is still re-validated with the *_RE regexes
// (and re-checked server-side regardless) before anything is submitted.

const NAME_UNSAFE_CHARS_RE = /[^a-zA-ZÀ-ÿ' .-]/g
export function sanitizeNameInput(value: string) {
  return value.replace(NAME_UNSAFE_CHARS_RE, '')
}

const ADDRESS_UNSAFE_CHARS_RE = /[^a-zA-Z0-9À-ÿ.,'#\-/() ]/g
export function sanitizeAddressInput(value: string) {
  return value.replace(ADDRESS_UNSAFE_CHARS_RE, '')
}

const EMAIL_UNSAFE_CHARS_RE = /[^a-zA-Z0-9._+@-]/g
export function sanitizeEmailInput(value: string) {
  return value.replace(EMAIL_UNSAFE_CHARS_RE, '')
}

const PHONE_UNSAFE_CHARS_RE = /[^0-9]/g
export function sanitizePhoneInput(value: string) {
  return value.replace(PHONE_UNSAFE_CHARS_RE, '')
}
