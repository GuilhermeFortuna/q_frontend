import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { useJobStream } from '@/lib/stream/jobStreamContext'
import { streamAwareRefetchInterval } from '@/lib/stream/jobQueryBridge'
import type {
  StrategySearchCandidateEquityArtifact,
  StrategySearchCandidateGenomeArtifact,
  StrategySearchConfig,
  StrategySearchResults,
  StrategySearchRunListResponse,
  StrategySearchStartResponse,
  StrategySearchStatus,
} from '@/types/strategySearch'
import {
  isStrategySearchTerminalStatus,
  shouldFetchStrategySearchResults,
} from '@/types/strategySearch'

export type StrategySearchHistoryParams = {
  limit?: number
  offset?: number
}

export const strategySearchKeys = {
  all: ['strategySearch'] as const,
  history: (params: StrategySearchHistoryParams = {}) =>
    [...strategySearchKeys.all, 'history', params] as const,
  status: (runId: string) => [...strategySearchKeys.all, 'status', runId] as const,
  results: (runId: string) => [...strategySearchKeys.all, 'results', runId] as const,
  candidateEquity: (runId: string, candidateId: string) =>
    [...strategySearchKeys.all, 'artifacts', 'equity', runId, candidateId] as const,
  candidateGenome: (runId: string, candidateId: string) =>
    [...strategySearchKeys.all, 'artifacts', 'genome', runId, candidateId] as const,
}

export async function startStrategySearch(
  body: StrategySearchConfig,
): Promise<StrategySearchStartResponse> {
  const { data } = await apiClient.post<StrategySearchStartResponse>(
    '/api/v1/strategy-search',
    body,
  )
  return data
}

async function fetchStrategySearchStatus(runId: string): Promise<StrategySearchStatus> {
  const { data } = await apiClient.get<StrategySearchStatus>(`/api/v1/strategy-search/${runId}`)
  return data
}

async function fetchStrategySearchResults(runId: string): Promise<StrategySearchResults> {
  const { data } = await apiClient.get<StrategySearchResults>(
    `/api/v1/strategy-search/${runId}/results`,
  )
  return data
}

async function fetchStrategySearchCandidateEquity(
  runId: string,
  candidateId: string,
): Promise<StrategySearchCandidateEquityArtifact> {
  const { data } = await apiClient.get<StrategySearchCandidateEquityArtifact>(
    `/api/v1/strategy-search/${runId}/candidates/${candidateId}/artifacts/equity`,
  )
  return data
}

async function fetchStrategySearchCandidateGenome(
  runId: string,
  candidateId: string,
): Promise<StrategySearchCandidateGenomeArtifact> {
  const { data } = await apiClient.get<StrategySearchCandidateGenomeArtifact>(
    `/api/v1/strategy-search/${runId}/candidates/${candidateId}/genome`,
  )
  return data
}

export async function fetchStrategySearchHistory(
  params: StrategySearchHistoryParams = {},
): Promise<StrategySearchRunListResponse> {
  const { data } = await apiClient.get<StrategySearchRunListResponse>('/api/v1/strategy-searches', {
    params,
  })
  return data
}

export async function deleteStrategySearchRun(runId: string): Promise<void> {
  await apiClient.delete(`/api/v1/strategy-searches/${runId}`)
}

export async function cancelStrategySearch(runId: string): Promise<StrategySearchStatus> {
  const { data } = await apiClient.post<StrategySearchStatus>(
    `/api/v1/strategy-search/${runId}/cancel`,
  )
  return data
}

export function useStartStrategySearch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: strategySearchKeys.all,
    mutationFn: startStrategySearch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...strategySearchKeys.all, 'history'] })
    },
  })
}

export function useStrategySearchHistory(params: StrategySearchHistoryParams = {}) {
  return useQuery({
    queryKey: strategySearchKeys.history(params),
    queryFn: () => fetchStrategySearchHistory(params),
  })
}

export function useCancelStrategySearch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: cancelStrategySearch,
    onSuccess: (status, runId) => {
      // Reflect the cancelled status immediately so polling stops and the
      // progress modal closes without waiting for the next status poll.
      queryClient.setQueryData(strategySearchKeys.status(runId), status)
      queryClient.invalidateQueries({ queryKey: [...strategySearchKeys.all, 'history'] })
    },
  })
}

export function useDeleteStrategySearch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteStrategySearchRun,
    onSuccess: (_data, runId) => {
      queryClient.removeQueries({ queryKey: strategySearchKeys.status(runId) })
      queryClient.removeQueries({ queryKey: strategySearchKeys.results(runId) })
      queryClient.invalidateQueries({ queryKey: [...strategySearchKeys.all, 'history'] })
    },
  })
}

export function useStrategySearchStatus(runId: string | null) {
  useJobStream()
  return useQuery({
    queryKey: strategySearchKeys.status(runId ?? ''),
    queryFn: () => fetchStrategySearchStatus(runId as string),
    enabled: !!runId,
    refetchInterval: streamAwareRefetchInterval('strategy_search', (query) => {
      const status = query.state.data?.status
      return status && !isStrategySearchTerminalStatus(status) ? 1000 : false
    }),
  })
}

export function useStrategySearchResults(runId: string | null, ready: boolean) {
  return useQuery({
    queryKey: strategySearchKeys.results(runId ?? ''),
    queryFn: () => fetchStrategySearchResults(runId as string),
    enabled: !!runId && ready,
    staleTime: Infinity,
  })
}

export function useStrategySearchCandidateEquity(
  runId: string | null,
  candidateId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: strategySearchKeys.candidateEquity(runId ?? '', candidateId ?? ''),
    queryFn: () => fetchStrategySearchCandidateEquity(runId as string, candidateId as string),
    enabled: !!runId && !!candidateId && enabled,
    staleTime: Infinity,
  })
}

export function useStrategySearchCandidateGenome(
  runId: string | null,
  candidateId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: strategySearchKeys.candidateGenome(runId ?? '', candidateId ?? ''),
    queryFn: () => fetchStrategySearchCandidateGenome(runId as string, candidateId as string),
    enabled: !!runId && !!candidateId && enabled,
    staleTime: Infinity,
  })
}

export { shouldFetchStrategySearchResults }
