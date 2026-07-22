/** Renders complaints.ticket_number as the bank-queue-style "CMP-000123" the app shows everywhere. */
export function formatTicketNumber(ticketNumber: number | null | undefined): string {
  if (ticketNumber == null) return 'CMP-??????'
  return `CMP-${String(ticketNumber).padStart(6, '0')}`
}
