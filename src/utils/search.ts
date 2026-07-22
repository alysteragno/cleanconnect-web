/**
 * Escapes Postgres LIKE/ILIKE metacharacters (`%`, `_`, `\`) so a user's
 * search term is matched literally instead of being interpreted as a SQL
 * wildcard — e.g. typing "%" shouldn't match every row.
 */
export function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/**
 * Wraps a filter value in double quotes per PostgREST's filter-value syntax,
 * so commas/parens/spaces (e.g. from a LIKE pattern already escaped with
 * `escapeLikeTerm`) survive being passed through `.or()` unparsed as query
 * syntax.
 */
export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
