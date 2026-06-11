import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type {
  WalkForwardEquityPoint,
  WalkForwardRequest,
  WalkForwardResults,
  WalkForwardRunListResponse,
  WalkForwardStartResponse,
  WalkForwardStatus,
} from '@/types/walkforward'
import { isWalkForwardTerminalStatus, shouldFetchWalkForwardResults } from '@/types/walkforward'

export type WalkForwardHistoryParams = {
  limit?: number
  offset?: number
}

export const walkforwardKeys = {
  all: ['walkforward'] as const,
  history: (params: WalkForwardHistoryParams = {}) =>
    [...walkforwardKeys.all, 'history', params] as const,
  status: (runId: string) => [...walkforwardKeys.all, 'status', runId] as const,
  results: (runId: string) => [...walkforwardKeys.all, 'results', runId] as const,
  equityArtifact: (runId: string) =>
    [...walkforwardKeys.all, 'artifacts', 'equity', runId] as const,
}

export async function startWalkForward(
  body: WalkForwardRequest,
): Promise<WalkForwardStartResponse> {
  const { data } = await apiClient.post<WalkForwardStartResponse>('/api/v1/walkforward', body)
  return data
}

async function fetchWalkForwardStatus(runId: string): Promise<WalkForwardStatus> {
  const { data } = await apiClient.get<WalkForwardStatus>(`/api/v1/walkforward/${runId}`)
  return data
}

async function fetchWalkForwardResults(runId: string): Promise<WalkForwardResults> {
  const { data } = await apiClient.get<WalkForwardResults>(`/api/v1/walkforward/${runId}/results`)
  return data
}

async function fetchWalkForwardEquityArtifact(
  runId: string,
): Promise<{ run_id: string; points: WalkForwardEquityPoint[] }> {
  const { data } = await apiClient.get<{ run_id: string; points: WalkForwardEquityPoint[] }>(
    `/api/v1/walkforward/${runId}/artifacts/equity`,
  )
  return data
}

export async function fetchWalkForwardHistory(
  params: WalkForwardHistoryParams = {},
): Promise<WalkForwardRunListResponse> {
  const { data } = await apiClient.get<WalkForwardRunListResponse>('/api/v1/walkforwards', {
    params,
  })
  return data
}

export async function deleteWalkForwardRun(runId: string): Promise<void> {
  await apiClient.delete(`/api/v1/walkforwards/${runId}`)
}

export async function cancelWalkForward(runId: string): Promise<WalkForwardStatus> {
  const { data } = await apiClient.post<WalkForwardStatus>(`/api/v1/walkforward/${runId}/cancel`)
  return data
}

export function useStartWalkForward() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: walkforwardKeys.all,
    mutationFn: startWalkForward,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...walkforwardKeys.all, 'history'] })
    },
  })
}

export function useWalkForwardHistory(params: WalkForwardHistoryParams = {}) {
  return useQuery({
    queryKey: walkforwardKeys.history(params),
    queryFn: () => fetchWalkForwardHistory(params),
  })
}

export function useCancelWalkForward() {
  return useMutation({
    mutationFn: cancelWalkForward,
  })
}

export function useDeleteWalkForward() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteWalkForwardRun,
    onSuccess: (_data, runId) => {
      queryClient.removeQueries({ queryKey: walkforwardKeys.status(runId) })
      queryClient.removeQueries({ queryKey: walkforwardKeys.results(runId) })
      queryClient.removeQueries({ queryKey: walkforwardKeys.equityArtifact(runId) })
      queryClient.invalidateQueries({ queryKey: [...walkforwardKeys.all, 'history'] })
    },
  })
}

export function useWalkForwardStatus(runId: string | null) {
  return useQuery({
    queryKey: walkforwardKeys.status(runId ?? ''),
    queryFn: () => fetchWalkForwardStatus(runId as string),
    enabled: !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && !isWalkForwardTerminalStatus(status) ? 1000 : false
    },
  })
}

export function useWalkForwardResults(runId: string | null, ready: boolean) {
  return useQuery({
    queryKey: walkforwardKeys.results(runId ?? ''),
    queryFn: () => fetchWalkForwardResults(runId as string),
    enabled: !!runId && ready,
    staleTime: Infinity,
  })
}

export function useWalkForwardEquityArtifact(runId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: walkforwardKeys.equityArtifact(runId ?? ''),
    queryFn: () => fetchWalkForwardEquityArtifact(runId as string),
    enabled: !!runId && enabled,
    staleTime: Infinity,
  })
}

export { shouldFetchWalkForwardResults }
