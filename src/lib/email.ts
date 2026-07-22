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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}
