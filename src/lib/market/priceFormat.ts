/** Display precision for a symbol's prices. `tickSize` is the smallest price step. */
export type PriceFormat = {
  digits: number
  tickSize: number
}

/** Decimals inferred from loaded bars never exceed this, whatever the closes look like. */
export const MAX_INFERRED_DIGITS = 6
const FALLBACK_DIGITS = 2

/** Decimal places of `value` after rounding away binary float noise at `MAX_INFERRED_DIGITS`. */
export function decimalPlaces(value: number): number {
  if (!Number.isFinite(value)) return 0
  const text = String(Number(value.toFixed(MAX_INFERRED_DIGITS)))
  const exponent = text.indexOf('e-')
  if (exponent >= 0) {
    const mantissa = text.slice(0, exponent)
    return Number(text.slice(exponent + 2)) + (mantissa.split('.')[1]?.length ?? 0)
  }
  return text.split('.')[1]?.length ?? 0
}

/** The largest number of decimals among `values`, capped at `MAX_INFERRED_DIGITS`. */
export function inferDigits(values: number[]): number {
  let digits = 0
  for (const value of values) {
    digits = Math.max(digits, decimalPlaces(value))
  }
  return Math.min(digits, MAX_INFERRED_DIGITS)
}

export function tickSizeForDigits(digits: number): number {
  return 10 ** -digits
}

/** Precision for a chart: instrument info first, then the snapshot, then the loaded closes. */
export function resolvePriceFormat({
  instrument,
  snapshotDigits,
  bars,
}: {
  instrument?: { digits: number; tickSize: number } | null
  snapshotDigits?: number | null
  bars: ReadonlyArray<{ close: number }>
}): PriceFormat {
  const digits =
    validDigits(instrument?.digits) ??
    validDigits(snapshotDigits) ??
    (bars.length > 0 ? inferDigits(bars.map((bar) => bar.close)) : FALLBACK_DIGITS)
  const tickSize =
    instrument && Number.isFinite(instrument.tickSize) && instrument.tickSize > 0
      ? instrument.tickSize
      : tickSizeForDigits(digits)
  return { digits, tickSize }
}

function validDigits(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10
    ? value
    : null
}

export function formatPrice(value: number, digits: number): string {
  return value.toFixed(digits)
}

/** Rounds `price` to the nearest multiple of `tickSize`, expressed at `digits` decimals. */
export function snapToTick(price: number, tickSize: number, digits: number): number {
  if (!(tickSize > 0)) return Number(price.toFixed(digits))
  return Number((Math.round(price / tickSize) * tickSize).toFixed(digits))
}
