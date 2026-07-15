export type ChatMessage = {
  id: string
  message: string
  created_at: string
  sender_id: string
  profiles?: { full_name: string; role: string } | null
}

export function formatMsgTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

export function formatDayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function groupMessagesByDay<T extends { created_at: string }>(messages: T[]) {
  const groups: { day: string; msgs: T[] }[] = []
  for (const msg of messages) {
    const day = new Date(msg.created_at).toDateString()
    const last = groups[groups.length - 1]
    if (!last || last.day !== day) groups.push({ day, msgs: [msg] })
    else last.msgs.push(msg)
  }
  return groups
}

// Support conversations auto-archive after this many days of no activity from
// either side. Shorter than complaints (which are manual-only) since support
// chat is a higher-volume, lower-stakes inbox that benefits from tidying
// itself up automatically.
export const SUPPORT_AUTO_ARCHIVE_DAYS = 14

// A support conversation is archived if an admin explicitly archived it, or if
// it's been inactive longer than the auto-archive window. `restoredAt` (set
// when an admin restores a manually-archived conversation) acts as a fresh
// activity baseline so a restore doesn't get immediately swept back into
// Archived by the inactivity rule.
export function isSupportConversationArchived({
  archivedAt,
  restoredAt,
  lastActivityAt,
}: {
  archivedAt: string | null
  restoredAt: string | null
  lastActivityAt: string
}) {
  if (archivedAt) return true
  const lastActivityMs = new Date(lastActivityAt).getTime()
  const restoredMs = restoredAt ? new Date(restoredAt).getTime() : -Infinity
  const baselineMs = Math.max(lastActivityMs, restoredMs)
  const daysInactive = (Date.now() - baselineMs) / 86_400_000
  return daysInactive > SUPPORT_AUTO_ARCHIVE_DAYS
}

// Days left before a still-active conversation gets auto-archived, so the
// admin can see the countdown instead of being surprised by it. Returns null
// once the conversation has already been manually archived (the countdown no
// longer applies).
export function daysUntilSupportAutoArchive({
  archivedAt,
  restoredAt,
  lastActivityAt,
}: {
  archivedAt: string | null
  restoredAt: string | null
  lastActivityAt: string
}): number | null {
  if (archivedAt) return null
  const lastActivityMs = new Date(lastActivityAt).getTime()
  const restoredMs = restoredAt ? new Date(restoredAt).getTime() : -Infinity
  const baselineMs = Math.max(lastActivityMs, restoredMs)
  const deadlineMs = baselineMs + SUPPORT_AUTO_ARCHIVE_DAYS * 86_400_000
  return Math.ceil((deadlineMs - Date.now()) / 86_400_000)
}
