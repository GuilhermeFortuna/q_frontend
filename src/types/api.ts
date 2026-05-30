export type WorkspaceId = 'launcher' | 'market-data' | 'research' | 'backtests' | 'system'

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

export type MarketSnapshot = {
  symbol: string
  last: number
  changePct: number
  volume: number
}
