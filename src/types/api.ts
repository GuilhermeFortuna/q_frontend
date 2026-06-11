export type WorkspaceId =
  | 'launcher'
  | 'market-data'
  | 'research'
  | 'backtests'
  | 'optimize'
  | 'system'

export type SystemHealth = {
  status: 'healthy' | 'degraded' | 'down'
  backendVersion: string
  dataLakeStatus: 'online' | 'syncing' | 'offline'
  lastSyncAt: string
}

export type Instrument = {
  symbol: string
  name: string
  exchange: string
  assetClass: 'equity' | 'etf' | 'fx' | 'crypto' | 'future'
}

export type OhlcvBar = {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type OhlcvAvailableRange = {
  symbol: string
  timeframe: string
  start: string
  end: string
  bar_count: number
}

export type MarketSnapshot = {
  symbol: string
  last: number
  changePct: number
  volume: number
  bid: number
  ask: number
  spread: number
  changeAbs: number
  dayOpen: number
  dayHigh: number
  dayLow: number
  prevClose: number
  digits: number
  tickTime: string | null
}

export type MarketSnapshotsResponse = {
  snapshots: MarketSnapshot[]
}
