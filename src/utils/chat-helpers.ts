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
