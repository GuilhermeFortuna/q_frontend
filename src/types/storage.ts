export type DataSourceMode = 'auto' | 'mt5' | 'local'

export type DataSourceSettings = {
  source: DataSourceMode
  mt5_available: boolean
  active_provider: 'mt5' | 'local'
}

export type StorageKind = 'bars' | 'ticks'

export type StorageInventoryItem = {
  symbol: string
  kind?: StorageKind
  timeframe?: string
  start: string
  end: string
  rows: number
  bytes: number
  updated_at: string
}

export type StorageInventoryResponse = {
  root: string
  items: StorageInventoryItem[]
}

export type IngestKind = StorageKind

export type IngestRequest = {
  symbol: string
  timeframes: string[]
  start: string
  end: string
  kind: IngestKind
}

export type IngestJobStatus = 'queued' | 'running' | 'completed' | 'failed'

export type IngestTimeframeResult = {
  timeframe: string
  rows?: number
  start?: string | null
  end?: string | null
  status: 'completed' | 'failed'
  error?: string | null
}

export type IngestStartResponse = {
  job_id: string
  status: 'queued'
}

export type IngestJob = {
  job_id: string
  status: IngestJobStatus
  progress: number
  detail: string
  results: IngestTimeframeResult[] | null
  error: string | null
}

export function isIngestTerminalStatus(status: IngestJobStatus | undefined): boolean {
  return status === 'completed' || status === 'failed'
}

export function resolveInventoryKind(item: StorageInventoryItem): StorageKind {
  if (item.kind === 'ticks' || item.kind === 'bars') {
    return item.kind
  }
  return item.timeframe ? 'bars' : 'ticks'
}

export function inventoryItemKey(item: StorageInventoryItem): string {
  const kind = resolveInventoryKind(item)
  return kind === 'ticks' ? `${item.symbol}-ticks` : `${item.symbol}-${item.timeframe}`
}

/** All OHLCV timeframe names accepted by q_backend (WO47 metatrader TIMEFRAME_NAMES). */
export const ACCEPTED_OHLCV_TIMEFRAMES = [
  'M1',
  'M2',
  'M3',
  'M4',
  'M5',
  'M6',
  'M10',
  'M12',
  'M15',
  'M20',
  'M30',
  'H1',
  'H2',
  'H3',
  'H4',
  'H6',
  'H8',
  'H12',
  'D1',
  'W1',
  'MN1',
] as const

/** Common subset shown in the Storage download multi-select (all values ⊆ ACCEPTED_OHLCV_TIMEFRAMES). */
export const STORAGE_TIMEFRAME_OPTIONS = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'] as const
