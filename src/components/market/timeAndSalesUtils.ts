import type { Tick } from '@/types/api'

export function getTickDisplayPrice(tick: Tick): number {
  return tick.last === 0 ? tick.bid : tick.last
}

export function getTickPriceColorClass(
  tick: Tick,
  previousPrice: number | null,
  price: number,
): string {
  if (tick.side === 'buy') {
    return 'text-emerald-400'
  }
  if (tick.side === 'sell') {
    return 'text-rose-400'
  }
  if (previousPrice === null) {
    return 'text-silver-300'
  }
  if (price > previousPrice) {
    return 'text-emerald-400'
  }
  if (price < previousPrice) {
    return 'text-rose-400'
  }
  return 'text-silver-300'
}
