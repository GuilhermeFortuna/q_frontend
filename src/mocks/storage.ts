import type { DataSourceSettings, StorageInventoryItem } from '@/types/storage'

export const mockStorageInventory: StorageInventoryItem[] = [
  {
    symbol: 'PETR4',
    kind: 'bars',
    timeframe: 'D1',
    start: '2024-01-01T00:00:00',
    end: '2024-06-01T00:00:00',
    rows: 130,
    bytes: 18_432,
    updated_at: new Date().toISOString(),
  },
  {
    symbol: 'VALE3',
    kind: 'bars',
    timeframe: 'H1',
    start: '2024-03-01T00:00:00',
    end: '2024-04-01T00:00:00',
    rows: 520,
    bytes: 42_000,
    updated_at: new Date().toISOString(),
  },
  {
    symbol: 'WIN$',
    kind: 'ticks',
    start: '2024-01-15T10:00:00',
    end: '2024-01-16T16:30:00',
    rows: 842_000,
    bytes: 48_500_000,
    updated_at: new Date().toISOString(),
  },
]

export const mockDataSource: DataSourceSettings = {
  source: 'auto',
  mt5_available: false,
  active_provider: 'local',
}

type MockIngestJob = {
  job_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  progress: number
  detail: string
  results: Array<{
    timeframe: string
    rows: number
    start: string
    end: string
    status: 'completed' | 'failed'
    error?: string | null
  }> | null
  error: string | null
  poll_count: number
  request: {
    symbol: string
    timeframes: string[]
    kind: 'bars' | 'ticks'
  }
}

const mockIngestJobs = new Map<string, MockIngestJob>()

const defaultBarInventory = (): StorageInventoryItem[] => [
  {
    symbol: 'PETR4',
    kind: 'bars',
    timeframe: 'D1',
    start: '2024-01-01T00:00:00',
    end: '2024-06-01T00:00:00',
    rows: 130,
    bytes: 18_432,
    updated_at: new Date().toISOString(),
  },
  {
    symbol: 'VALE3',
    kind: 'bars',
    timeframe: 'H1',
    start: '2024-03-01T00:00:00',
    end: '2024-04-01T00:00:00',
    rows: 520,
    bytes: 42_000,
    updated_at: new Date().toISOString(),
  },
  {
    symbol: 'WIN$',
    kind: 'ticks',
    start: '2024-01-15T10:00:00',
    end: '2024-01-16T16:30:00',
    rows: 842_000,
    bytes: 48_500_000,
    updated_at: new Date().toISOString(),
  },
]

export function resetMockStorageState() {
  mockStorageInventory.splice(0, mockStorageInventory.length, ...defaultBarInventory())
  Object.assign(mockDataSource, {
    source: 'auto',
    mt5_available: false,
    active_provider: 'local',
  })
  mockIngestJobs.clear()
}

export function createMockIngestJob(body: {
  symbol: string
  timeframes: string[]
  start: string
  end: string
  kind?: 'bars' | 'ticks'
}): MockIngestJob {
  const job_id = `ingest_${Math.random().toString(36).slice(2, 10)}`
  const job: MockIngestJob = {
    job_id,
    status: 'queued',
    progress: 0,
    detail: 'Queued',
    results: null,
    error: null,
    poll_count: 0,
    request: {
      symbol: body.symbol.toUpperCase(),
      timeframes: body.timeframes,
      kind: body.kind ?? 'bars',
    },
  }
  mockIngestJobs.set(job_id, job)
  return job
}

function advanceBarsIngest(job: MockIngestJob): void {
  job.poll_count += 1
  if (job.poll_count === 1) {
    job.status = 'running'
    job.progress = 0.35
    job.detail = `Ingesting ${job.request.symbol} ${job.request.timeframes[0]} bars (1/${job.request.timeframes.length})`
    job.results = []
  } else if (job.poll_count === 2) {
    job.status = 'running'
    job.progress = 0.75
    job.detail = `Ingesting ${job.request.symbol}`
    job.results = job.request.timeframes.slice(0, 1).map((timeframe) => ({
      timeframe,
      rows: 120,
      start: '2024-01-01T00:00:00',
      end: '2024-06-01T00:00:00',
      status: 'completed' as const,
      error: null,
    }))
  } else {
    job.status = 'completed'
    job.progress = 1
    job.detail = `Ingestion completed for ${job.request.symbol}`
    job.results = job.request.timeframes.map((timeframe) => ({
      timeframe,
      rows: 120,
      start: '2024-01-01T00:00:00',
      end: '2024-06-01T00:00:00',
      status: 'completed' as const,
      error: null,
    }))

    for (const timeframe of job.request.timeframes) {
      const exists = mockStorageInventory.some(
        (item) =>
          item.symbol === job.request.symbol &&
          item.kind === 'bars' &&
          item.timeframe === timeframe,
      )
      if (!exists) {
        mockStorageInventory.push({
          symbol: job.request.symbol,
          kind: 'bars',
          timeframe,
          start: '2024-01-01T00:00:00',
          end: '2024-06-01T00:00:00',
          rows: 120,
          bytes: 16_384,
          updated_at: new Date().toISOString(),
        })
      }
    }
  }
}

function advanceTicksIngest(job: MockIngestJob): void {
  const months = ['2024-03', '2024-04']
  job.poll_count += 1
  if (job.poll_count === 1) {
    job.status = 'running'
    job.progress = 0.25
    job.detail = `Ingesting ${job.request.symbol} ticks ${months[0]} (1/${months.length})`
    job.results = []
  } else if (job.poll_count === 2) {
    job.status = 'running'
    job.progress = 0.65
    job.detail = `Ingesting ${job.request.symbol} ticks ${months[1]} (2/${months.length})`
    job.results = [
      {
        timeframe: months[0],
        rows: 120_000,
        start: '2024-03-01T00:00:00',
        end: '2024-03-31T23:59:59',
        status: 'completed',
        error: null,
      },
    ]
  } else {
    job.status = 'completed'
    job.progress = 1
    job.detail = `Tick ingestion completed for ${job.request.symbol}`
    job.results = months.map((month) => ({
      timeframe: month,
      rows: 120_000,
      start: '2024-03-01T00:00:00',
      end: '2024-04-30T23:59:59',
      status: 'completed' as const,
      error: null,
    }))

    const exists = mockStorageInventory.some(
      (item) => item.symbol === job.request.symbol && item.kind === 'ticks',
    )
    if (!exists) {
      mockStorageInventory.push({
        symbol: job.request.symbol,
        kind: 'ticks',
        start: '2024-03-01T00:00:00',
        end: '2024-04-30T23:59:59',
        rows: 240_000,
        bytes: 12_800_000,
        updated_at: new Date().toISOString(),
      })
    }
  }
}

export function getUpdatedMockIngestJob(jobId: string): MockIngestJob | undefined {
  const job = mockIngestJobs.get(jobId)
  if (!job) return undefined

  if (job.request.kind === 'ticks') {
    advanceTicksIngest(job)
  } else {
    advanceBarsIngest(job)
  }

  return job
}

export function ingestStatusPayload(job: MockIngestJob) {
  return {
    job_id: job.job_id,
    status: job.status,
    progress: job.progress,
    detail: job.detail,
    results: job.results,
    error: job.error,
  }
}

export function getMockIngestJob(jobId: string) {
  return mockIngestJobs.get(jobId)
}
