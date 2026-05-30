import type { Instrument, MarketSnapshot, OhlcvBar, SystemHealth } from '@/types/api'

export const mockSystemHealth: SystemHealth = {
  status: 'healthy',
  backendVersion: '0.1.0-mock',
  dataLakeStatus: 'online',
  lastSyncAt: new Date().toISOString(),
}

export const mockInstruments: Instrument[] = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', exchange: 'ARCA', assetClass: 'etf' },
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', assetClass: 'equity' },
  { symbol: 'EURUSD', name: 'Euro / US Dollar', exchange: 'FX', assetClass: 'fx' },
  { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', exchange: 'CRYPTO', assetClass: 'crypto' },
]

export const mockSnapshots: Record<string, MarketSnapshot> = {
  SPY: { symbol: 'SPY', last: 512.34, changePct: 0.42, volume: 48_200_000 },
  AAPL: { symbol: 'AAPL', last: 198.12, changePct: -0.18, volume: 52_100_000 },
  EURUSD: { symbol: 'EURUSD', last: 1.0842, changePct: 0.05, volume: 0 },
  BTCUSD: { symbol: 'BTCUSD', last: 67_420.5, changePct: 1.24, volume: 0 },
}

function generateOhlcv(symbol: string, points = 30): OhlcvBar[] {
  const base = mockSnapshots[symbol]?.last ?? 100
  const bars: OhlcvBar[] = []
  let price = base * 0.98

  for (let i = points - 1; i >= 0; i -= 1) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const drift = (Math.random() - 0.48) * (base * 0.008)
    const open = price
    const close = open + drift
    const high = Math.max(open, close) + Math.random() * (base * 0.003)
    const low = Math.min(open, close) - Math.random() * (base * 0.003)
    price = close

    bars.push({
      timestamp: date.toISOString(),
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume: Math.floor(1_000_000 + Math.random() * 4_000_000),
    })
  }

  return bars
}

export function getMockOhlcv(symbol: string): OhlcvBar[] {
  return generateOhlcv(symbol)
}
