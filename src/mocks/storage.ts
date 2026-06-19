import type { DataSourceSettings, StorageInventoryItem } from '@/types/storage'

export const mockStorageInventory: StorageInventoryItem[] = [
  {
    symbol: 'PETR4',
    timeframe: 'D1',
    start: '2024-01-01T00:00:00',
    end: '2024-06-01T00:00:00',
    rows: 130,
    bytes: 18_432,
    updated_at: new Date().toISOString(),
  },
  {
    symbol: 'VALE3',
    timeframe: 'H1',
    start: '2024-03-01T00:00:00',
    end: '2024-04-01T00:00:00',
    rows: 520,
    bytes: 42_000,
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
  }
}

const mockIngestJobs = new Map<string, MockIngestJob>()

export function resetMockStorageState() {
  mockStorageInventory.splice(
    0,
    mockStorageInventory.length,
    {
      symbol: 'PETR4',
      timeframe: 'D1',
      start: '2024-01-01T00:00:00',
      end: '2024-06-01T00:00:00',
      rows: 130,
      bytes: 18_432,
      updated_at: new Date().toISOString(),
    },
    {
      symbol: 'VALE3',
      timeframe: 'H1',
      start: '2024-03-01T00:00:00',
      end: '2024-04-01T00:00:00',
      rows: 520,
      bytes: 42_000,
      updated_at: new Date().toISOString(),
    },
  )
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
    request: { symbol: body.symbol.toUpperCase(), timeframes: body.timeframes },
  }
  mockIngestJobs.set(job_id, job)
  return job
}

export function getUpdatedMockIngestJob(jobId: string): MockIngestJob | undefined {
  const job = mockIngestJobs.get(jobId)
  if (!job) return undefined

  job.poll_count += 1
  if (job.poll_count === 1) {
    job.status = 'running'
    job.progress = 0.35
    job.detail = `Ingesting ${job.request.symbol} ${job.request.timeframes[0]}`
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
        (item) => item.symbol === job.request.symbol && item.timeframe === timeframe,
      )
      if (!exists) {
        mockStorageInventory.push({
          symbol: job.request.symbol,
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
