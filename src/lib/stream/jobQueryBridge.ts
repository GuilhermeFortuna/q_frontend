import type { Query, QueryClient, QueryKey } from '@tanstack/react-query'

import type { JobStreamClient, StreamStatus } from '@/lib/stream/client'
import type { JobKey, JobKind, JobProgressEffect, JobTerminalEffect } from '@/lib/stream/reconciler'

export const PROGRESS_REFRESH_MIN_INTERVAL_MS = 1_000

export const JOB_STATUS_QUERY_KEYS: Record<JobKind, (jobId: string) => QueryKey> = {
  alpha_research: (jobId) => ['experiments', 'alphaResearch', jobId],
  backtest: (jobId) => ['backtests', 'job-status', jobId],
  discovery_ab: (jobId) => ['experiments', 'discoveryAb', jobId],
  encoder_ablation: (jobId) => ['experiments', 'encoderAblation', jobId],
  neural_training: (jobId) => ['neural', 'trainingRun', jobId],
  optimization: (jobId) => ['optimize', 'status', jobId],
  storage_ingest: (jobId) => ['storage', 'ingest', jobId],
  strategy_search: (jobId) => ['strategySearch', 'status', jobId],
  walkforward: (jobId) => ['walkforward', 'status', jobId],
}

let currentStreamStatus: StreamStatus = 'disabled'

type ThrottleState = { last: number; timer: ReturnType<typeof setTimeout> | null }

function splitJobKey(key: JobKey): { kind: JobKind; jobId: string } {
  const separator = key.indexOf(':')
  return {
    kind: key.slice(0, separator) as JobKind,
    jobId: key.slice(separator + 1),
  }
}

function isJobStatusQuery(queryKey: QueryKey): boolean {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return false
  const jobId = queryKey[queryKey.length - 1]
  if (typeof jobId !== 'string') return false
  return Object.values(JOB_STATUS_QUERY_KEYS).some(
    (keyFn) => JSON.stringify(keyFn(jobId)) === JSON.stringify(queryKey),
  )
}

function invalidateJobStatus(queryClient: QueryClient, key: JobKey) {
  const { kind, jobId } = splitJobKey(key)
  void queryClient.invalidateQueries({ queryKey: JOB_STATUS_QUERY_KEYS[kind](jobId) })
}

function invalidateActiveJobStatusQueries(queryClient: QueryClient) {
  for (const query of queryClient.getQueryCache().findAll({ type: 'active' })) {
    if (isJobStatusQuery(query.queryKey)) {
      void queryClient.invalidateQueries({ queryKey: query.queryKey })
    }
  }
}

export function streamAwareRefetchInterval<T>(
  kind: JobKind,
  pollingInterval: (query: Query<T>) => number | false,
): (query: Query<T>) => number | false {
  void kind
  return (query) => {
    if (currentStreamStatus === 'live') return false
    return pollingInterval(query)
  }
}

export function connectJobStreamToQueryClient(
  client: JobStreamClient,
  queryClient: QueryClient,
): () => void {
  currentStreamStatus = client.status()
  const throttles = new Map<JobKey, ThrottleState>()

  function invalidateProgress(key: JobKey) {
    const now = Date.now()
    const state = throttles.get(key) ?? { last: 0, timer: null }
    throttles.set(key, state)
    const remaining = PROGRESS_REFRESH_MIN_INTERVAL_MS - (now - state.last)
    if (remaining <= 0) {
      if (state.timer) {
        clearTimeout(state.timer)
        state.timer = null
      }
      state.last = now
      invalidateJobStatus(queryClient, key)
      return
    }
    if (state.timer) clearTimeout(state.timer)
    state.timer = setTimeout(() => {
      state.last = Date.now()
      state.timer = null
      invalidateJobStatus(queryClient, key)
    }, remaining)
  }

  function onJobEvent(event: JobProgressEffect | JobTerminalEffect) {
    if (event.type === 'jobTerminal') {
      const state = throttles.get(event.key)
      if (state?.timer) {
        clearTimeout(state.timer)
        state.timer = null
      }
      invalidateJobStatus(queryClient, event.key)
      return
    }
    invalidateProgress(event.key)
  }

  const unsubJobs = client.onJobEvent(onJobEvent)
  const unsubStatus = client.onStatus((status) => {
    const previous = currentStreamStatus
    currentStreamStatus = status
    if (status === 'unavailable' && previous !== 'unavailable') {
      invalidateActiveJobStatusQueries(queryClient)
    }
  })

  return () => {
    unsubJobs()
    unsubStatus()
    for (const state of throttles.values()) {
      if (state.timer) clearTimeout(state.timer)
    }
    throttles.clear()
    currentStreamStatus = 'disabled'
  }
}
