import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import axios from 'axios'
import { useEffect } from 'react'

import { apiClient } from '@/api/client'
import type { BacktestStatusResponse } from '../../../contracts/api'
import { useJobStream } from '@/lib/stream/jobStreamContext'
import { streamAwareRefetchInterval } from '@/lib/stream/jobQueryBridge'
import { useAppStore } from '@/store/useAppStore'
import type {
  BacktestEquityArtifactResponse,
  BacktestEquityArtifactResult,
  BacktestHistorySort,
  BacktestRequest,
  BacktestResponse,
  BacktestRunDetail,
  BacktestRunListResponse,
  BulkDeleteResponse,
} from '@/types/backtesting'

export type BacktestStartResponse = { run_id: string; status: string }

export type BacktestHistoryParams = {
  limit?: number
  offset?: number
  symbol?: string
  strategy?: string
  saved_only?: boolean
  sort?: BacktestHistorySort
}

const HISTORY_PAGE_SIZE = 50

export const backtestKeys = {
  all: ['backtests'] as const,
  history: (params: Omit<BacktestHistoryParams, 'offset'> = {}) =>
    [...backtestKeys.all, 'history', params] as const,
  run: (runId: string) => [...backtestKeys.all, 'run', runId] as const,
  equityArtifact: (runId: string) => [...backtestKeys.all, 'equity-artifact', runId] as const,
  jobStatus: (runId: string) => [...backtestKeys.all, 'job-status', runId] as const,
  jobResult: (runId: string) => [...backtestKeys.all, 'job-result', runId] as const,
}

export async function startBacktest(request: BacktestRequest): Promise<BacktestStartResponse> {
  const { data } = await apiClient.post<BacktestStartResponse>('/api/v1/backtest', request)
  return data
}

export async function fetchBacktestJobStatus(runId: string): Promise<BacktestStatusResponse> {
  const { data } = await apiClient.get<BacktestStatusResponse>(`/api/v1/backtest/${runId}`)
  return data
}

export async function fetchBacktestResult(runId: string): Promise<BacktestResponse> {
  const { data } = await apiClient.get<BacktestResponse>(`/api/v1/backtest/${runId}/result`)
  return data
}

export async function fetchBacktestHistory(
  params: BacktestHistoryParams = {},
): Promise<BacktestRunListResponse> {
  const { data } = await apiClient.get<BacktestRunListResponse>('/api/v1/backtests', { params })
  return data
}

export async function fetchBacktestRun(runId: string): Promise<BacktestRunDetail> {
  const { data } = await apiClient.get<BacktestRunDetail>(`/api/v1/backtests/${runId}`)
  return data
}

export async function patchBacktestRunSaved(
  runId: string,
  isSaved: boolean,
): Promise<BacktestRunDetail> {
  const { data } = await apiClient.patch<BacktestRunDetail>(`/api/v1/backtests/${runId}`, {
    is_saved: isSaved,
  })
  return data
}

export async function bulkDeleteBacktestRuns(runIds: string[]): Promise<BulkDeleteResponse> {
  const { data } = await apiClient.post<BulkDeleteResponse>('/api/v1/backtests/bulk-delete', {
    run_ids: runIds,
  })
  return data
}

export async function deleteBacktestRun(runId: string): Promise<void> {
  await apiClient.delete(`/api/v1/backtests/${runId}`)
}

export async function fetchBacktestEquityArtifact(
  runId: string,
): Promise<BacktestEquityArtifactResult> {
  try {
    const { data } = await apiClient.get<BacktestEquityArtifactResponse>(
      `/api/v1/backtests/${runId}/artifacts/equity`,
    )
    return {
      run_id: data.run_id,
      availability: 'available',
      points: data.points,
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return {
        run_id: runId,
        availability: 'unavailable',
        points: [],
      }
    }
    throw error
  }
}

export function useBacktestEquityArtifact(runId: string | null) {
  return useQuery({
    queryKey: backtestKeys.equityArtifact(runId ?? ''),
    queryFn: () => fetchBacktestEquityArtifact(runId as string),
    enabled: !!runId,
    staleTime: Infinity,
  })
}

export function useBacktestEquityArtifacts(runIds: string[]) {
  return useQueries({
    queries: runIds.map((runId) => ({
      queryKey: backtestKeys.equityArtifact(runId),
      queryFn: () => fetchBacktestEquityArtifact(runId),
      staleTime: Infinity,
    })),
  })
}

export function useBacktestJobStatus(runId: string | null, enabled = true) {
  useJobStream()
  return useQuery({
    queryKey: backtestKeys.jobStatus(runId ?? ''),
    queryFn: () => fetchBacktestJobStatus(runId as string),
    enabled: enabled && !!runId,
    refetchInterval: streamAwareRefetchInterval('backtest', (query) =>
      query.state.data?.status === 'running' ? 1000 : false,
    ),
  })
}

/**
 * Backtests run asynchronously on the worker pool. This hook mirrors the old
 * `useRunBacktest` mutation surface (`mutate`/`data`/`isPending`/`error`) but
 * underneath it submits the job, persists the run id (so it survives navigation
 * and shows in the dock), polls status, then fetches the full chart payload.
 */
export function useBacktestJob() {
  const queryClient = useQueryClient()
  const runId = useAppStore((s) => s.backtestSession.runId)
  const workflowMode = useAppStore((s) => s.backtestSession.workflowMode)
  const patchBacktestSession = useAppStore((s) => s.patchBacktestSession)
  const simulationActive = workflowMode === 'backtest'

  const start = useMutation({
    mutationKey: backtestKeys.all,
    mutationFn: startBacktest,
    onSuccess: (data) => {
      patchBacktestSession({ runId: data.run_id })
    },
  })

  const status = useBacktestJobStatus(runId, simulationActive)
  const jobStatus = status.data?.status

  const result = useQuery({
    queryKey: backtestKeys.jobResult(runId ?? ''),
    queryFn: () => fetchBacktestResult(runId as string),
    enabled: simulationActive && !!runId && jobStatus === 'completed',
    staleTime: Infinity,
  })

  // Refresh history once a run reaches a terminal state.
  useEffect(() => {
    if (jobStatus === 'completed' || jobStatus === 'failed') {
      queryClient.invalidateQueries({ queryKey: [...backtestKeys.all, 'history'] })
    }
  }, [jobStatus, queryClient])

  const isPending =
    start.isPending ||
    (!!runId && (jobStatus === 'running' || (jobStatus === undefined && status.isFetching)))

  const error: Error | null = start.error
    ? (start.error as Error)
    : jobStatus === 'failed'
      ? new Error(status.data?.error ?? 'Backtest failed')
      : ((result.error as Error | null) ?? null)

  return {
    mutate: (request: BacktestRequest) => start.mutate(request),
    reset: () => {
      patchBacktestSession({ runId: null })
      start.reset()
    },
    data: jobStatus === 'completed' ? result.data : undefined,
    isPending,
    error,
    status: jobStatus,
  }
}

export function useBacktestHistory(params: BacktestHistoryParams = {}) {
  return useQuery({
    queryKey: backtestKeys.history(params),
    queryFn: () => fetchBacktestHistory(params),
  })
}

export function useBacktestHistoryInfinite(
  params: Omit<BacktestHistoryParams, 'offset' | 'limit'> = {},
) {
  const limit = HISTORY_PAGE_SIZE
  const queryParams = { ...params, limit }

  return useInfiniteQuery({
    queryKey: backtestKeys.history(queryParams),
    queryFn: ({ pageParam = 0 }) => fetchBacktestHistory({ ...queryParams, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length
      return nextOffset < lastPage.total ? nextOffset : undefined
    },
  })
}

export function useBacktestRun(runId: string | null) {
  return useQuery({
    queryKey: backtestKeys.run(runId ?? ''),
    queryFn: () => fetchBacktestRun(runId as string),
    enabled: !!runId,
    staleTime: Infinity,
  })
}

export function useSaveBacktestRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ runId, isSaved }: { runId: string; isSaved: boolean }) =>
      patchBacktestRunSaved(runId, isSaved),
    onSuccess: (data) => {
      queryClient.setQueryData(backtestKeys.run(data.run_id), data)
      queryClient.invalidateQueries({ queryKey: [...backtestKeys.all, 'history'] })
    },
  })
}

export function useBulkDeleteBacktests() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkDeleteBacktestRuns,
    onSuccess: (_data, runIds) => {
      for (const runId of runIds) {
        queryClient.removeQueries({ queryKey: backtestKeys.run(runId) })
      }
      queryClient.invalidateQueries({ queryKey: [...backtestKeys.all, 'history'] })
    },
  })
}

export function useDeleteBacktest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteBacktestRun,
    onSuccess: (_data, runId) => {
      queryClient.removeQueries({ queryKey: backtestKeys.run(runId) })
      queryClient.invalidateQueries({ queryKey: [...backtestKeys.all, 'history'] })
    },
  })
}
