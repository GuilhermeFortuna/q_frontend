import { timeframeToMs } from '@/lib/market/timeframes'
import type { Instrument, MarketSnapshot, OhlcvBar, SystemHealth } from '@/types/api'

export const mockSystemHealth: SystemHealth = {
  status: 'healthy',
  backendVersion: '0.1.0-mock',
  dataLakeStatus: 'online',
  lastSyncAt: new Date().toISOString(),
}

export const mockInstruments: Instrument[] = [
  { symbol: 'PETR4', name: 'PETROBRAS PN N2', exchange: 'BOVESPA', assetClass: 'equity' },
  { symbol: 'VALE3', name: 'VALE ON NM', exchange: 'BOVESPA', assetClass: 'equity' },
  { symbol: 'ITUB4', name: 'ITAU UNIBANCO PN N1', exchange: 'BOVESPA', assetClass: 'equity' },
  { symbol: 'WIN$', name: 'IBOVESPA MINI', exchange: 'BMF', assetClass: 'future' },
  { symbol: 'WDO$', name: 'DOLAR MINI', exchange: 'BMF', assetClass: 'future' },
]

export const mockSnapshots: Record<string, MarketSnapshot> = {
  PETR4: { symbol: 'PETR4', last: 42.0, changePct: -1.2, volume: 48_200_000 },
  VALE3: { symbol: 'VALE3', last: 64.5, changePct: 0.35, volume: 52_100_000 },
  ITUB4: { symbol: 'ITUB4', last: 32.1, changePct: -0.8, volume: 35_000_000 },
  WIN$: { symbol: 'WIN$', last: 128400.0, changePct: 1.05, volume: 120_000 },
  WDO$: { symbol: 'WDO$', last: 5120.5, changePct: -0.45, volume: 95_000 },
  SPY: { symbol: 'SPY', last: 512.34, changePct: 0.42, volume: 48_200_000 },
  AAPL: { symbol: 'AAPL', last: 198.12, changePct: -0.18, volume: 52_100_000 },
  EURUSD: { symbol: 'EURUSD', last: 1.0842, changePct: 0.05, volume: 0 },
  BTCUSD: { symbol: 'BTCUSD', last: 67_420.5, changePct: 1.24, volume: 0 },
}

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function generateOhlcv(symbol: string, timeframe: string, points = 500): OhlcvBar[] {
  const base = mockSnapshots[symbol]?.last ?? 100
  const bars: OhlcvBar[] = []
  let price = base * 0.98
  const barMs = timeframeToMs(timeframe)
  const now = Date.now()

  for (let i = points - 1; i >= 0; i -= 1) {
    const timestamp = new Date(now - i * barMs).toISOString()
    const rand = seededRandom(i + symbol.charCodeAt(0) * 17)
    const drift = (rand - 0.48) * (base * 0.008)
    const open = price
    const close = open + drift
    const high = Math.max(open, close) + seededRandom(i * 3) * (base * 0.003)
    const low = Math.min(open, close) - seededRandom(i * 5) * (base * 0.003)
    price = close

    bars.push({
      timestamp,
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume: Math.floor(1_000_000 + seededRandom(i * 7) * 4_000_000),
    })
  }

  return bars
}

const mockSeriesCache = new Map<string, OhlcvBar[]>()

function getMockSeries(symbol: string, timeframe: string): OhlcvBar[] {
  const key = `${symbol}:${timeframe}`
  if (!mockSeriesCache.has(key)) {
    mockSeriesCache.set(key, generateOhlcv(symbol, timeframe, 5000))
  }
  return mockSeriesCache.get(key)!
}

export function getMockOhlcv(
  symbol: string,
  timeframe = 'D1',
  count = 500,
  range?: { start?: string; end?: string },
): OhlcvBar[] {
  const series = getMockSeries(symbol, timeframe)

  if (range?.start || range?.end) {
    const startMs = range.start ? new Date(range.start).getTime() : Number.NEGATIVE_INFINITY
    const endMs = range.end ? new Date(range.end).getTime() : Number.POSITIVE_INFINITY
    return series.filter((bar) => {
      const ts = new Date(bar.timestamp).getTime()
      return ts >= startMs && ts <= endMs
    })
  }

  const safeCount = Math.min(Math.max(count, 1), 5000)
  return series.slice(-safeCount)
}
