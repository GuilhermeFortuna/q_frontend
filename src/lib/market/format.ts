export function formatPrice(value: number, digits = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** Oscillator readout precision: fine digits for small values, fewer for large ones. */
export function formatIndicatorValue(value: number): string {
  const magnitude = Math.abs(value)
  const digits = magnitude >= 100 ? 1 : magnitude >= 1 ? 2 : 4
  return value.toFixed(digits)
}
