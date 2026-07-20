// Clamps a raw `?page=` search param to a valid 1-based page number for the
// given item count, so the server slice and the client Pagination control
// never disagree about which page is "current".
export function resolvePage(raw: string | undefined, totalItems: number, pageSize: number): number {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const n = Number(raw) || 1
  return Math.min(Math.max(1, n), totalPages)
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize)
}
