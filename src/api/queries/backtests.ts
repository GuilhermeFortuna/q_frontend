import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type {
  BacktestHistorySort,
  BacktestRequest,
  BacktestResponse,
  BacktestRunDetail,
  BacktestRunListResponse,
  BulkDeleteResponse,
} from '@/types/backtesting'

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
}

export async function runBacktest(request: BacktestRequest): Promise<BacktestResponse> {
  const { data } = await apiClient.post<BacktestResponse>('/api/v1/backtest/run', request)
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

export function useRunBacktest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: backtestKeys.all,
    mutationFn: runBacktest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...backtestKeys.all, 'history'] })
    },
  })
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
