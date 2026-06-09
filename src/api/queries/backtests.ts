import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type {
  BacktestRequest,
  BacktestResponse,
  BacktestRunDetail,
  BacktestRunListResponse,
} from '@/types/backtesting'

export type BacktestHistoryParams = {
  limit?: number
  offset?: number
  symbol?: string
}

export const backtestKeys = {
  all: ['backtests'] as const,
  history: (params: BacktestHistoryParams = {}) =>
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

export function useBacktestRun(runId: string | null) {
  return useQuery({
    queryKey: backtestKeys.run(runId ?? ''),
    queryFn: () => fetchBacktestRun(runId as string),
    enabled: !!runId,
    staleTime: Infinity,
  })
}

export function useDeleteBacktest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteBacktestRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...backtestKeys.all, 'history'] })
    },
  })
}
