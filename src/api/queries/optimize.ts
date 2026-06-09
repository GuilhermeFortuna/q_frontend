import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type {
  OptimizationConfig,
  OptimizationResults,
  OptimizationStartResponse,
  OptimizationStatus,
  OptimizationStudyListResponse,
} from '@/types/optimization'

export type OptimizationHistoryParams = {
  limit?: number
  offset?: number
}

export const optimizeKeys = {
  all: ['optimize'] as const,
  history: (params: OptimizationHistoryParams = {}) =>
    [...optimizeKeys.all, 'history', params] as const,
  status: (studyId: string) => [...optimizeKeys.all, 'status', studyId] as const,
  results: (studyId: string) => [...optimizeKeys.all, 'results', studyId] as const,
}

export async function startOptimization(
  config: OptimizationConfig,
): Promise<OptimizationStartResponse> {
  const { data } = await apiClient.post<OptimizationStartResponse>('/api/v1/optimize', config)
  return data
}

async function fetchOptimizationStatus(studyId: string): Promise<OptimizationStatus> {
  const { data } = await apiClient.get<OptimizationStatus>(`/api/v1/optimize/${studyId}`)
  return data
}

async function fetchOptimizationResults(studyId: string): Promise<OptimizationResults> {
  const { data } = await apiClient.get<OptimizationResults>(`/api/v1/optimize/${studyId}/results`)
  return data
}

export async function fetchOptimizationHistory(
  params: OptimizationHistoryParams = {},
): Promise<OptimizationStudyListResponse> {
  const { data } = await apiClient.get<OptimizationStudyListResponse>('/api/v1/optimizations', {
    params,
  })
  return data
}

export async function deleteOptimizationStudy(studyId: string): Promise<void> {
  await apiClient.delete(`/api/v1/optimizations/${studyId}`)
}

export async function cancelOptimization(studyId: string): Promise<OptimizationStatus> {
  const { data } = await apiClient.post<OptimizationStatus>(`/api/v1/optimize/${studyId}/cancel`)
  return data
}

export function useStartOptimization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: optimizeKeys.all,
    mutationFn: startOptimization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...optimizeKeys.all, 'history'] })
    },
  })
}

export function useOptimizationHistory(params: OptimizationHistoryParams = {}) {
  return useQuery({
    queryKey: optimizeKeys.history(params),
    queryFn: () => fetchOptimizationHistory(params),
  })
}

export function useCancelOptimization() {
  return useMutation({
    mutationFn: cancelOptimization,
  })
}

export function useDeleteOptimization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteOptimizationStudy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...optimizeKeys.all, 'history'] })
    },
  })
}

export function useOptimizationStatus(studyId: string | null) {
  return useQuery({
    queryKey: optimizeKeys.status(studyId ?? ''),
    queryFn: () => fetchOptimizationStatus(studyId as string),
    enabled: !!studyId,
    // Poll while the study is still running; stop once it reaches a terminal state.
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'pending' || status === 'running' ? 1000 : false
    },
  })
}

export function useOptimizationResults(studyId: string | null, ready: boolean) {
  return useQuery({
    queryKey: optimizeKeys.results(studyId ?? ''),
    queryFn: () => fetchOptimizationResults(studyId as string),
    enabled: !!studyId && ready,
    staleTime: Infinity,
  })
}
