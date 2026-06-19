/** Replace a lone leading zero when the user types another digit (e.g. "0" + "5" -> "05"). */
export function normalizeLeadingZero(previous: string, next: string): string {
  if (
    previous === '0' &&
    next.length === 2 &&
    next.startsWith('0') &&
    next[1] !== '.' &&
    /^\d$/.test(next[1] ?? '')
  ) {
    return next[1]!
  }
  return next
}

export function parseNumberInput(raw: string, integer = false): number | null {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '-' || trimmed === '.') {
    return null
  }

  const parsed = integer ? parseInt(trimmed, 10) : Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}
