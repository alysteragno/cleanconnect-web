import 'server-only'
import { Resend } from 'resend'

// Sends the "thank you for booking" confirmation email. Domain
// maidforyouph.com is verified in the Resend dashboard; RESEND_API_KEY is a
// sending-only scoped key (named "Booking Confirmation" in that dashboard).
// Never import this from a Client Component — the key must stay server-side.

function resendClient(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set.')
  return new Resend(key)
}

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? 'Maid For You <bookings@maidforyouph.com>'

export type BookingConfirmationDetails = {
  bookingId: string
  customerName: string
  serviceName: string
  serviceDate: string // ISO yyyy-mm-dd
  serviceTime: string // HH:MM[:SS]
  address: string
  basePrice: number | null
  paymentMethod: string
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  bank_transfer: 'Bank Transfer',
  qrph: 'QR Ph',
}

export async function sendBookingConfirmationEmail(
  details: BookingConfirmationDetails,
  to: string
): Promise<{ error?: string }> {
  const dateStr = formatDate(details.serviceDate)
  const timeStr = formatTime(details.serviceTime)
  const priceStr = details.basePrice != null
    ? `₱${Number(details.basePrice).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
    : 'To be confirmed'
  const paymentLabel = PAYMENT_METHOD_LABELS[details.paymentMethod] ?? details.paymentMethod

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      <div style="background: #db2777; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">Maid For You</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p style="font-size: 16px; margin-top: 0;">Hi ${escapeHtml(details.customerName)},</p>
        <p style="font-size: 15px; line-height: 1.6;">
          Thank you for booking with Maid For You! Your ${escapeHtml(details.serviceName)} appointment is set. Here are your booking details:
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #6b7280;">Service</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(details.serviceName)}</td></tr>
          <tr style="border-top: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Date</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${dateStr}</td></tr>
          <tr style="border-top: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Time</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${timeStr}</td></tr>
          <tr style="border-top: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Address</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(details.address)}</td></tr>
          <tr style="border-top: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Payment method</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(paymentLabel)}</td></tr>
          <tr style="border-top: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Amount</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${priceStr}</td></tr>
          <tr style="border-top: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Booking ID</td><td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${escapeHtml(details.bookingId)}</td></tr>
        </table>
        <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
          We'll notify you once a cleaner is assigned. If you need to make any changes, please reach out to us or manage your booking from the app.
        </p>
        <p style="font-size: 14px; margin-bottom: 0;">— The Maid For You Team</p>
      </div>
    </div>
  `.trim()

  const text = [
    `Hi ${details.customerName},`,
    ``,
    `Thank you for booking with Maid For You! Your ${details.serviceName} appointment is set. Here are your booking details:`,
    ``,
    `Service: ${details.serviceName}`,
    `Date: ${dateStr}`,
    `Time: ${timeStr}`,
    `Address: ${details.address}`,
    `Payment method: ${paymentLabel}`,
    `Amount: ${priceStr}`,
    `Booking ID: ${details.bookingId}`,
    ``,
    `We'll notify you once a cleaner is assigned.`,
    ``,
    `— The Maid For You Team`,
  ].join('\n')

  try {
    const { error } = await resendClient().emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `Booking Confirmed — ${details.serviceName} on ${dateStr}`,
      html,
      text,
    })
    if (error) return { error: error.message }
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to send booking confirmation email.' }
  }
}

export type PaymentReceiptDetails = {
  bookingId: string
  customerName: string
  serviceName: string
  serviceDate: string // ISO yyyy-mm-dd
  serviceTime: string // HH:MM[:SS]
  address: string
  amountPaid: number // pesos, what PayMongo actually settled
  /** e.g. 'qrph', 'gcash', 'card' — PayMongo's own source type for the payment used. */
  sourceType: string | null
  /** PayMongo Payment resource id — the receipt's reference/transaction number. */
  paymongoPaymentId: string
  paidAt: string // ISO timestamp
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  qrph: 'QR Ph',
  gcash: 'GCash',
  paymaya: 'Maya',
  card: 'Card',
}

export async function sendPaymentReceiptEmail(
  details: PaymentReceiptDetails,
  to: string
): Promise<{ error?: string }> {
  const dateStr = formatDate(details.serviceDate)
  const timeStr = formatTime(details.serviceTime)
  const amountStr = `₱${details.amountPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
  const paidAtStr = new Date(details.paidAt).toLocaleString('en-PH', {
    dateStyle: 'medium', timeStyle: 'short',
  })
  const methodLabel = details.sourceType
    ? (SOURCE_TYPE_LABELS[details.sourceType] ?? details.sourceType)
    : 'Online Payment'

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      <div style="background: #db2777; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">Maid For You</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p style="display: inline-block; background: #dcfce7; color: #16a34a; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; padding: 4px 10px; border-radius: 999px; margin: 0 0 16px;">PAYMENT RECEIVED</p>
        <p style="font-size: 16px; margin-top: 0;">Hi ${escapeHtml(details.customerName)},</p>
        <p style="font-size: 15px; line-height: 1.6;">
          We've received your payment for the ${escapeHtml(details.serviceName)} appointment. This email is your official receipt.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #6b7280;">Reference No.</td><td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${escapeHtml(details.paymongoPaymentId)}</td></tr>
          <tr style="border-top: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Booking ID</td><td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${escapeHtml(details.bookingId)}</td></tr>
          <tr style="border-top: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Service</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(details.serviceName)}</td></tr>
          <tr style="border-top: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Appointment</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${dateStr}, ${timeStr}</td></tr>
          <tr style="border-top: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Address</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(details.address)}</td></tr>
          <tr style="border-top: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Payment method</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${escapeHtml(methodLabel)}</td></tr>
          <tr style="border-top: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Date paid</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${paidAtStr}</td></tr>
          <tr style="border-top: 2px solid #e5e7eb;"><td style="padding: 12px 0 0; color: #111827; font-weight: 700;">Amount paid</td><td style="padding: 12px 0 0; text-align: right; font-weight: 700; font-size: 18px; color: #db2777;">${amountStr}</td></tr>
        </table>
        <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
          Keep this email for your records. If you have any questions about this charge, reach out to us and reference the booking ID above.
        </p>
        <p style="font-size: 14px; margin-bottom: 0;">— The Maid For You Team</p>
      </div>
    </div>
  `.trim()

  const text = [
    `Hi ${details.customerName},`,
    ``,
    `We've received your payment for the ${details.serviceName} appointment. This email is your official receipt.`,
    ``,
    `Reference No.: ${details.paymongoPaymentId}`,
    `Booking ID: ${details.bookingId}`,
    `Service: ${details.serviceName}`,
    `Appointment: ${dateStr}, ${timeStr}`,
    `Address: ${details.address}`,
    `Payment method: ${methodLabel}`,
    `Date paid: ${paidAtStr}`,
    `Amount paid: ${amountStr}`,
    ``,
    `Keep this email for your records.`,
    ``,
    `— The Maid For You Team`,
  ].join('\n')

  try {
    const { error } = await resendClient().emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `Payment Receipt — ${details.serviceName} on ${dateStr}`,
      html,
      text,
    })
    if (error) return { error: error.message }
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to send payment receipt email.' }
  }
}

export type CustomerWelcomeDetails = {
  customerName: string
  magicLink: string
}

// Sent when an admin creates a customer account manually (walk-in/phone-in
// booking). Carries a magic-link token generated via
// adminClient.auth.admin.generateLink({ type: 'magiclink' }) — verified by
// the same token_hash + type handling in src/app/auth/callback/route.ts
// already used for signup/invite confirmations — instead of Supabase's own
// built-in "reset password" email, so the customer gets our branded template
// and lands on /reset-password already signed in to set their real password.
export async function sendCustomerWelcomeEmail(
  details: CustomerWelcomeDetails,
  to: string
): Promise<{ error?: string }> {
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      <div style="background: #db2777; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">Maid For You</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p style="font-size: 16px; margin-top: 0;">Hi ${escapeHtml(details.customerName)},</p>
        <p style="font-size: 15px; line-height: 1.6;">
          An account has been created for you with Maid For You. Click the button below to sign in and set your password.
        </p>
        <p style="text-align: center; margin: 28px 0;">
          <a href="${details.magicLink}" style="display: inline-block; background: #db2777; color: #fff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px;">
            Set Your Password
          </a>
        </p>
        <p style="font-size: 13px; color: #6b7280; line-height: 1.6;">
          This link will sign you in directly — no password needed until you set one. If you didn&rsquo;t expect this email, you can safely ignore it.
        </p>
        <p style="font-size: 14px; margin-bottom: 0;">— The Maid For You Team</p>
      </div>
    </div>
  `.trim()

  const text = [
    `Hi ${details.customerName},`,
    ``,
    `An account has been created for you with Maid For You. Use the link below to sign in and set your password:`,
    ``,
    details.magicLink,
    ``,
    `If you didn't expect this email, you can safely ignore it.`,
    ``,
    `— The Maid For You Team`,
  ].join('\n')

  try {
    const { error } = await resendClient().emails.send({
      from: FROM_ADDRESS,
      to,
      subject: 'Welcome to Maid For You — Set Your Password',
      html,
      text,
    })
    if (error) return { error: error.message }
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to send welcome email.' }
  }
}

export type CustomerConfirmationDetails = {
  customerName: string
  confirmLink: string
}

// Sent when a customer self-registers from the mobile app. Carries a
// token_hash generated via adminClient.auth.admin.generateLink({ type:
// 'signup' }) — verified by the same token_hash + type handling in
// src/app/auth/callback/route.ts already used for the admin-created-customer
// magic-link flow, instead of Supabase's own built-in confirmation email
// (which deep-links back into the mobile app and can't be relied on across
// Expo Go / custom-scheme setups). Lands on /email-confirmed once verified.
export async function sendCustomerConfirmationEmail(
  details: CustomerConfirmationDetails,
  to: string
): Promise<{ error?: string }> {
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      <div style="background: #db2777; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">Maid For You</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p style="font-size: 16px; margin-top: 0;">Hi ${escapeHtml(details.customerName)},</p>
        <p style="font-size: 15px; line-height: 1.6;">
          Thanks for creating a Maid For You account! Click the button below to confirm your email and start booking.
        </p>
        <p style="text-align: center; margin: 28px 0;">
          <a href="${details.confirmLink}" style="display: inline-block; background: #db2777; color: #fff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px;">
            Confirm Your Email
          </a>
        </p>
        <p style="font-size: 13px; color: #6b7280; line-height: 1.6;">
          After confirming, head back to the Maid For You mobile app and sign in with the password you chose. If you didn&rsquo;t create this account, you can safely ignore this email.
        </p>
        <p style="font-size: 14px; margin-bottom: 0;">— The Maid For You Team</p>
      </div>
    </div>
  `.trim()

  const text = [
    `Hi ${details.customerName},`,
    ``,
    `Thanks for creating a Maid For You account! Use the link below to confirm your email and start booking:`,
    ``,
    details.confirmLink,
    ``,
    `After confirming, head back to the Maid For You mobile app and sign in with the password you chose.`,
    ``,
    `If you didn't create this account, you can safely ignore this email.`,
    ``,
    `— The Maid For You Team`,
  ].join('\n')

  try {
    const { error } = await resendClient().emails.send({
      from: FROM_ADDRESS,
      to,
      subject: 'Confirm your email — Maid For You',
      html,
      text,
    })
    if (error) return { error: error.message }
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to send confirmation email.' }
  }
}

export type PasswordResetDetails = {
  customerName: string
  magicLink: string
}

// Sent for the web /forgot-password flow, using the same magic-link pattern
// as sendCustomerWelcomeEmail above (adminClient.auth.admin.generateLink with
// type 'magiclink', verified by the token_hash + type handling in
// src/app/auth/callback/route.ts) instead of Supabase's own built-in
// "reset password" email, so this one also gets our branded template.
export async function sendPasswordResetEmail(
  details: PasswordResetDetails,
  to: string
): Promise<{ error?: string }> {
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      <div style="background: #db2777; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">Maid For You</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p style="font-size: 16px; margin-top: 0;">Hi ${escapeHtml(details.customerName)},</p>
        <p style="font-size: 15px; line-height: 1.6;">
          We received a request to reset your Maid For You password. Click the button below to sign in and set a new one.
        </p>
        <p style="text-align: center; margin: 28px 0;">
          <a href="${details.magicLink}" style="display: inline-block; background: #db2777; color: #fff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px;">
            Reset Your Password
          </a>
        </p>
        <p style="font-size: 13px; color: #6b7280; line-height: 1.6;">
          This link will sign you in directly — no current password needed. If you didn&rsquo;t request this, you can safely ignore this email; your password won&rsquo;t change.
        </p>
        <p style="font-size: 14px; margin-bottom: 0;">— The Maid For You Team</p>
      </div>
    </div>
  `.trim()

  const text = [
    `Hi ${details.customerName},`,
    ``,
    `We received a request to reset your Maid For You password. Use the link below to sign in and set a new one:`,
    ``,
    details.magicLink,
    ``,
    `If you didn't request this, you can safely ignore this email; your password won't change.`,
    ``,
    `— The Maid For You Team`,
  ].join('\n')

  try {
    const { error } = await resendClient().emails.send({
      from: FROM_ADDRESS,
      to,
      subject: 'Reset Your Password — Maid For You',
      html,
      text,
    })
    if (error) return { error: error.message }
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to send password reset email.' }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}
