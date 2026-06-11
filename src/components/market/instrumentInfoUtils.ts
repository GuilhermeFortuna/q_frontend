export function formatSpecNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '—'
  }

  return value
    .toString()
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
}
