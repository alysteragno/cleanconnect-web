/**
 * Escapes Postgres LIKE/ILIKE metacharacters (`%`, `_`, `\`) so a user's
 * search term is matched literally instead of being interpreted as a SQL
 * wildcard — e.g. typing "%" shouldn't match every row.
 */
export function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`)
}
