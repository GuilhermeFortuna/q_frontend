import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useBacktestJobStatus } from '@/api/queries/backtests'
import {
  useDiscoveryAbRun,
  useEncoderAblationRun,
  useAlphaResearchRun,
} from '@/api/queries/experiments'
import { useNeuralTrainingRun } from '@/api/queries/neural'
import { useOptimizationStatus } from '@/api/queries/optimize'
import { useIngestStatus } from '@/api/queries/storage'
import { useStrategySearchStatus } from '@/api/queries/strategySearch'
import { useWalkForwardStatus } from '@/api/queries/walkforward'
import { JobStreamClient } from '@/lib/stream/client'
import { JobStreamProvider } from '@/lib/stream/JobStreamProvider'
import type { JobKind } from '@/lib/stream/reconciler'

class FakeSocket {
  url: string
  readyState = 0
  sent: string[] = []
  private listeners = new Map<string, Set<(event: { data?: string }) => void>>()

  constructor(url: string) {
    this.url = url
  }

  addEventListener(type: string, fn: (event: { data?: string }) => void) {
    const set = this.listeners.get(type) ?? new Set()
    set.add(fn)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, fn: (event: { data?: string }) => void) {
    this.listeners.get(type)?.delete(fn)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = 3
    this.listeners.get('close')?.forEach((fn) => fn({}))
  }

  open() {
    this.readyState = 1
    this.listeners.get('open')?.forEach((fn) => fn({}))
  }

  deliver(data: string) {
    this.listeners.get('message')?.forEach((fn) => fn({ data }))
  }
}

const subscribed = JSON.stringify({
  type: 'subscribed',
  topics: {
    'jobs.terminal': { cursor: '0-0', epoch: 'e1', last_seq: 0 },
    'jobs.progress': { cursor: '0-0', epoch: 'e1', last_seq: 0 },
  },
})

function createStream() {
  const sockets: FakeSocket[] = []
  const client = new JobStreamClient('ws://127.0.0.1:8000/api/v1/stream', {
    socketFactory: (url) => {
      const socket = new FakeSocket(url)
      sockets.push(socket)
      return socket as unknown as WebSocket
    },
    fetchSnapshot: async () => ({
      jobs: [],
      watermark: { 'jobs.terminal': { epoch: 'e1', seq: 0 } },
    }),
    fetchHistory: async () => ({
      topic: 'jobs.terminal',
      epoch: 'e1',
      next_seq: null,
      entries: [],
    }),
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  })
  return { client, sockets }
}

async function goLive(client: JobStreamClient, sockets: FakeSocket[]) {
  const release = client.retain()
  sockets[0].open()
  sockets[0].deliver(subscribed)
  await vi.waitFor(() => expect(client.status()).toBe('live'))
  return release
}

type Case = {
  kind: JobKind
  jobId: string
  interval: number
  path: string
  body: Record<string, unknown>
  useHook: () => unknown
}

const cases: Case[] = [
  {
    kind: 'backtest',
    jobId: 'bt-1',
    interval: 1000,
    path: '/api/v1/backtest/bt-1',
    body: { run_id: 'bt-1', status: 'running', error: null },
    useHook: () => useBacktestJobStatus('bt-1'),
  },
  {
    kind: 'optimization',
    jobId: 'opt-1',
    interval: 1000,
    path: '/api/v1/optimize/opt-1',
    body: {
      study_id: 'opt-1',
      status: 'running',
      completed_trials: 1,
      n_trials: 10,
      best_value: null,
      best_params: {},
      error: null,
    },
    useHook: () => useOptimizationStatus('opt-1'),
  },
  {
    kind: 'walkforward',
    jobId: 'wf-1',
    interval: 1000,
    path: '/api/v1/walkforward/wf-1',
    body: {
      run_id: 'wf-1',
      status: 'running',
      current_window: 0,
      total_windows: 4,
      phase: 'optimizing',
      windows_completed: 0,
      error: null,
    },
    useHook: () => useWalkForwardStatus('wf-1'),
  },
  {
    kind: 'strategy_search',
    jobId: 'ss-1',
    interval: 1000,
    path: '/api/v1/strategy-search/ss-1',
    body: {
      run_id: 'ss-1',
      status: 'running',
      current_candidate: 0,
      total_candidates: 8,
      candidate_id: null,
      strategy: null,
      phase: null,
      window_index: null,
      total_windows: null,
      error: null,
    },
    useHook: () => useStrategySearchStatus('ss-1'),
  },
  {
    kind: 'neural_training',
    jobId: 'nn-1',
    interval: 800,
    path: '/api/v1/neural/models/train/nn-1',
    body: { job_id: 'nn-1', status: 'running', progress: 'training' },
    useHook: () => useNeuralTrainingRun('nn-1', { isRunning: true }),
  },
  {
    kind: 'storage_ingest',
    jobId: 'ing-1',
    interval: 1000,
    path: '/api/v1/storage/ingest/ing-1',
    body: {
      job_id: 'ing-1',
      status: 'running',
      progress: 0.2,
      detail: 'ingesting',
      results: null,
      error: null,
    },
    useHook: () => useIngestStatus('ing-1'),
  },
  {
    kind: 'discovery_ab',
    jobId: 'dab-1',
    interval: 1000,
    path: '/api/v1/experiments/discovery-ab/dab-1',
    body: {
      job_id: 'dab-1',
      status: 'running',
      progress: 0.2,
      detail: 'running',
      result: null,
      error: null,
    },
    useHook: () => useDiscoveryAbRun('dab-1'),
  },
  {
    kind: 'encoder_ablation',
    jobId: 'enc-1',
    interval: 1000,
    path: '/api/v1/experiments/encoder-ablation/enc-1',
    body: { job_id: 'enc-1', status: 'running', progress: 'running', result: null, error: null },
    useHook: () => useEncoderAblationRun('enc-1'),
  },
  {
    kind: 'alpha_research',
    jobId: 'ar-1',
    interval: 1000,
    path: '/api/v1/experiments/alpha-research/ar-1',
    body: { job_id: 'ar-1', status: 'running', progress: 0.2, result: null, error: null },
    useHook: () => useAlphaResearchRun('ar-1'),
  },
]

function terminalFrame(kind: JobKind, jobId: string) {
  return JSON.stringify({
    topic: 'jobs.terminal',
    schema_major: 1,
    seq: 1,
    epoch: 'e1',
    producer_id: 'test',
    origin_ts: '2026-09-12T10:00:00.000000Z',
    payload_kind: 'control',
    payload_schema: 'schema/stream/payloads/job-terminal.schema.json',
    payload: {
      kind,
      job_id: jobId,
      status: 'completed',
      finished_at: '2026-09-12T10:00:01.000000Z',
    },
    key: { kind, job_id: jobId },
  })
}

describe.each(cases)('job status stream: $kind', (jobCase) => {
  const server = setupServer()

  afterEach(() => {
    vi.useRealTimers()
    server.close()
  })

  it('does not poll while live, refreshes on terminal, and resumes polling after close', async () => {
    let statusRequests = 0
    server.use(
      http.get(`*${jobCase.path}`, () => {
        statusRequests += 1
        return HttpResponse.json(jobCase.body)
      }),
    )
    server.listen({ onUnhandledRequest: 'error' })

    const { client, sockets } = createStream()
    const releaseLive = await goLive(client, sockets)

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(JobStreamProvider, { client, children }),
      )

    renderHook(() => jobCase.useHook(), { wrapper })
    await waitFor(() => expect(statusRequests).toBe(1))

    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(statusRequests).toBe(1)

    await act(async () => {
      sockets[0].deliver(terminalFrame(jobCase.kind, jobCase.jobId))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(statusRequests).toBe(2)

    await act(async () => {
      sockets[0].close()
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(statusRequests).toBeGreaterThanOrEqual(3)

    const afterClose = statusRequests
    await act(async () => {
      await vi.advanceTimersByTimeAsync(jobCase.interval)
    })
    expect(statusRequests).toBeGreaterThan(afterClose)

    releaseLive()
  })
})
