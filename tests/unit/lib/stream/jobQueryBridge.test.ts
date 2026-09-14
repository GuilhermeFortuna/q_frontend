import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { backtestKeys } from '@/api/queries/backtests'
import { experimentKeys } from '@/api/queries/experiments'
import { neuralKeys } from '@/api/queries/neural'
import { optimizeKeys } from '@/api/queries/optimize'
import { storageKeys } from '@/api/queries/storage'
import { strategySearchKeys } from '@/api/queries/strategySearch'
import { walkforwardKeys } from '@/api/queries/walkforward'
import type { JobProgressEffect, JobTerminalEffect } from '@/lib/stream/reconciler'
import {
  connectJobStreamToQueryClient,
  JOB_STATUS_QUERY_KEYS,
  PROGRESS_REFRESH_MIN_INTERVAL_MS,
  streamAwareRefetchInterval,
} from '@/lib/stream/jobQueryBridge'
import type { StreamStatus } from '@/lib/stream/client'

class FakeJobStream {
  statusValue: StreamStatus = 'connecting'
  private readonly statusListeners = new Set<(status: StreamStatus) => void>()
  private readonly jobListeners = new Set<(event: JobProgressEffect | JobTerminalEffect) => void>()

  status(): StreamStatus {
    return this.statusValue
  }

  onStatus(fn: (status: StreamStatus) => void): () => void {
    this.statusListeners.add(fn)
    return () => {
      this.statusListeners.delete(fn)
    }
  }

  onJobEvent(fn: (event: JobProgressEffect | JobTerminalEffect) => void): () => void {
    this.jobListeners.add(fn)
    return () => {
      this.jobListeners.delete(fn)
    }
  }

  emitStatus(status: StreamStatus) {
    this.statusValue = status
    for (const listener of this.statusListeners) listener(status)
  }

  emitJob(event: JobProgressEffect | JobTerminalEffect) {
    for (const listener of this.jobListeners) listener(event)
  }
}

const progressEvent = (jobId = 'r1'): JobProgressEffect => ({
  type: 'jobProgress',
  key: `backtest:${jobId}`,
  payload: { kind: 'backtest', job_id: jobId, status: 'running', progress: 0.4 },
})

const terminalEvent = (jobId = 'r1'): JobTerminalEffect => ({
  type: 'jobTerminal',
  key: `backtest:${jobId}`,
  payload: {
    kind: 'backtest',
    job_id: jobId,
    status: 'completed',
    finished_at: '2026-09-12T10:00:00.000000Z',
  },
})

afterEach(() => {
  vi.useRealTimers()
})

describe('jobQueryBridge', () => {
  it('invalidates the matching status query once on a terminal event', () => {
    const queryClient = new QueryClient()
    const stream = new FakeJobStream()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const stop = connectJobStreamToQueryClient(stream as never, queryClient)

    stream.emitJob(terminalEvent('r1'))

    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: backtestKeys.jobStatus('r1') })
    stop()
  })

  it('throttles progress invalidations to leading and trailing once per second', () => {
    vi.useFakeTimers()
    const queryClient = new QueryClient()
    const stream = new FakeJobStream()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const stop = connectJobStreamToQueryClient(stream as never, queryClient)

    for (let i = 0; i < 20; i += 1) {
      stream.emitJob(progressEvent('r1'))
      vi.advanceTimersByTime(500 / 19)
    }

    expect(invalidate.mock.calls.length).toBeLessThanOrEqual(1)
    vi.advanceTimersByTime(PROGRESS_REFRESH_MIN_INTERVAL_MS)
    expect(invalidate).toHaveBeenCalledTimes(2)
    stop()
  })

  it('returns false while live and the wrapped interval while unavailable', () => {
    const stream = new FakeJobStream()
    const queryClient = new QueryClient()
    const stop = connectJobStreamToQueryClient(stream as never, queryClient)
    const interval = streamAwareRefetchInterval('backtest', () => 1000)

    stream.emitStatus('live')
    expect(interval({} as never)).toBe(false)

    stream.emitStatus('unavailable')
    expect(interval({} as never)).toBe(1000)
    stop()
  })

  it('invalidates all nine kinds of active status queries when the stream becomes unavailable', () => {
    const queryClient = new QueryClient()
    const stream = new FakeJobStream()
    stream.statusValue = 'live'
    const observers = Object.values(JOB_STATUS_QUERY_KEYS).map((keyFn) => {
      const observer = new QueryObserver(queryClient, {
        queryKey: keyFn('job-1'),
        queryFn: async () => ({ status: 'running' }),
        staleTime: Infinity,
      })
      observer.subscribe(() => {})
      return observer
    })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const stop = connectJobStreamToQueryClient(stream as never, queryClient)

    stream.emitStatus('unavailable')

    expect(invalidate).toHaveBeenCalledTimes(9)
    for (const keyFn of Object.values(JOB_STATUS_QUERY_KEYS)) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: keyFn('job-1') })
    }

    observers.forEach((observer) => observer.destroy())
    stop()
  })

  it('maps all nine job kinds onto the existing status query keys', () => {
    expect(Object.keys(JOB_STATUS_QUERY_KEYS)).toHaveLength(9)
    expect(JOB_STATUS_QUERY_KEYS.backtest('r1')).toEqual(backtestKeys.jobStatus('r1'))
    expect(JOB_STATUS_QUERY_KEYS.optimization('r1')).toEqual(optimizeKeys.status('r1'))
    expect(JOB_STATUS_QUERY_KEYS.walkforward('r1')).toEqual(walkforwardKeys.status('r1'))
    expect(JOB_STATUS_QUERY_KEYS.strategy_search('r1')).toEqual(strategySearchKeys.status('r1'))
    expect(JOB_STATUS_QUERY_KEYS.neural_training('r1')).toEqual(neuralKeys.trainingRun('r1'))
    expect(JOB_STATUS_QUERY_KEYS.storage_ingest('r1')).toEqual(storageKeys.ingestStatus('r1'))
    expect(JOB_STATUS_QUERY_KEYS.discovery_ab('r1')).toEqual(experimentKeys.discoveryAb('r1'))
    expect(JOB_STATUS_QUERY_KEYS.encoder_ablation('r1')).toEqual(
      experimentKeys.encoderAblation('r1'),
    )
    expect(JOB_STATUS_QUERY_KEYS.alpha_research('r1')).toEqual(experimentKeys.alphaResearch('r1'))
  })
})
