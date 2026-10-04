import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

import { apiClient } from '@/api/client'
import type {
  MlFilterComparisonRequest,
  MlFilterComparisonStartResponse,
  MlFilterComparisonStatusResponse,
  MlFilterErrorCode,
  MlFilterEvaluationRequest,
  MlFilterEvaluationStartResponse,
  MlFilterEvaluationStatusResponse,
  MlFilterJobStatus,
  MlFilterModelDetailResponse,
  MlFilterModelListResponse,
  MlFilterSourceListResponse,
  MlFilterSourceSummary,
  MlFilterTrainingRequest,
  MlFilterTrainingStartResponse,
  MlFilterTrainingStatusResponse,
} from '../../../contracts/api'

/** The generated detail type is `unknown` for this allOf schema; mirror its documented shape. */
export type MlFilterSourceDetail = MlFilterSourceSummary & {
  eligibility_errors?: string[]
  split_suggestion?: { train_end: string; validation_end: string } | null
  volume_readiness?: string | null
}

export type MlFilterModelListParams = {
  dataset_id?: string
  symbol?: string
  timeframe?: string
  limit?: number
  offset?: number
}

export const mlFilterKeys = {
  all: ['mlFilters'] as const,
  sources: (params: { limit?: number; offset?: number } = {}) =>
    [...mlFilterKeys.all, 'sources', params] as const,
  source: (runId: string) => [...mlFilterKeys.all, 'source', runId] as const,
  models: (params: MlFilterModelListParams = {}) =>
    [...mlFilterKeys.all, 'models', params] as const,
  model: (modelVersionId: string) => [...mlFilterKeys.all, 'model', modelVersionId] as const,
  trainingJob: (jobId: string) => [...mlFilterKeys.all, 'training', jobId] as const,
  comparisonJob: (jobId: string) => [...mlFilterKeys.all, 'comparison', jobId] as const,
  evaluationJob: (jobId: string) => [...mlFilterKeys.all, 'evaluation', jobId] as const,
}

export const ML_FILTER_POLL_MS = 800

export function isMlFilterJobTerminal(status: MlFilterJobStatus | undefined): boolean {
  return status === 'completed' || status === 'failed'
}

export async function fetchMlFilterSources(
  params: { limit?: number; offset?: number } = {},
): Promise<MlFilterSourceListResponse> {
  const { data } = await apiClient.get<MlFilterSourceListResponse>('/api/v1/ml-filters/sources', {
    params,
  })
  return data
}

export async function fetchMlFilterSource(runId: string): Promise<MlFilterSourceDetail> {
  const { data } = await apiClient.get<MlFilterSourceDetail>(
    `/api/v1/ml-filters/sources/${encodeURIComponent(runId)}`,
  )
  return data
}

export async function fetchMlFilterModels(
  params: MlFilterModelListParams = {},
): Promise<MlFilterModelListResponse> {
  const { data } = await apiClient.get<MlFilterModelListResponse>('/api/v1/ml-filters/models', {
    params,
  })
  return data
}

export async function fetchMlFilterModel(
  modelVersionId: string,
): Promise<MlFilterModelDetailResponse> {
  const { data } = await apiClient.get<MlFilterModelDetailResponse>(
    `/api/v1/ml-filters/models/${encodeURIComponent(modelVersionId)}`,
  )
  return data
}

export async function startMlFilterTraining(
  request: MlFilterTrainingRequest,
): Promise<MlFilterTrainingStartResponse> {
  const { data } = await apiClient.post<MlFilterTrainingStartResponse>(
    '/api/v1/ml-filters/training',
    request,
  )
  return data
}

export async function fetchMlFilterTrainingJob(
  jobId: string,
): Promise<MlFilterTrainingStatusResponse> {
  const { data } = await apiClient.get<MlFilterTrainingStatusResponse>(
    `/api/v1/ml-filters/training/${encodeURIComponent(jobId)}`,
  )
  return data
}

export async function startMlFilterComparison(
  request: MlFilterComparisonRequest,
): Promise<MlFilterComparisonStartResponse> {
  const { data } = await apiClient.post<MlFilterComparisonStartResponse>(
    '/api/v1/ml-filters/comparisons',
    request,
  )
  return data
}

export async function fetchMlFilterComparisonJob(
  jobId: string,
): Promise<MlFilterComparisonStatusResponse> {
  const { data } = await apiClient.get<MlFilterComparisonStatusResponse>(
    `/api/v1/ml-filters/comparisons/${encodeURIComponent(jobId)}`,
  )
  return data
}

export async function startMlFilterEvaluation(
  request: MlFilterEvaluationRequest,
): Promise<MlFilterEvaluationStartResponse> {
  const { data } = await apiClient.post<MlFilterEvaluationStartResponse>(
    '/api/v1/ml-filters/evaluations',
    request,
  )
  return data
}

export async function fetchMlFilterEvaluationJob(
  jobId: string,
): Promise<MlFilterEvaluationStatusResponse> {
  const { data } = await apiClient.get<MlFilterEvaluationStatusResponse>(
    `/api/v1/ml-filters/evaluations/${encodeURIComponent(jobId)}`,
  )
  return data
}

export type MlFilterRequestError = { code: MlFilterErrorCode | null; message: string }

/** Normalises FastAPI `detail` (string or `{code, message}`) and bare ErrorResponse bodies. */
export function parseMlFilterError(error: unknown, fallback: string): MlFilterRequestError {
  if (!axios.isAxiosError(error)) {
    return { code: null, message: error instanceof Error ? error.message : fallback }
  }
  const data = error.response?.data as
    | { detail?: unknown; code?: string; message?: string }
    | undefined
  const detail = data?.detail
  if (typeof detail === 'string' && detail.length > 0) {
    return { code: null, message: detail }
  }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const body = detail as { code?: string; message?: string }
    return { code: (body.code as MlFilterErrorCode) ?? null, message: body.message ?? fallback }
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string }
    return { code: null, message: first.msg ?? fallback }
  }
  if (data?.message) {
    return { code: (data.code as MlFilterErrorCode) ?? null, message: data.message }
  }
  return { code: null, message: fallback }
}

export function getMlFilterErrorMessage(
  error: unknown,
  fallback = 'The ML filter request failed.',
): string {
  return parseMlFilterError(error, fallback).message
}

export function useMlFilterSources(params: { limit?: number; offset?: number } = {}) {
  return useQuery({
    queryKey: mlFilterKeys.sources(params),
    queryFn: () => fetchMlFilterSources(params),
  })
}

export function useMlFilterSource(runId: string | null) {
  return useQuery({
    queryKey: mlFilterKeys.source(runId ?? ''),
    queryFn: () => fetchMlFilterSource(runId as string),
    enabled: !!runId,
  })
}

export function useMlFilterModels(
  params: MlFilterModelListParams = {},
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: mlFilterKeys.models(params),
    queryFn: () => fetchMlFilterModels(params),
    enabled,
  })
}

export function useMlFilterModel(modelVersionId: string | null) {
  return useQuery({
    queryKey: mlFilterKeys.model(modelVersionId ?? ''),
    queryFn: () => fetchMlFilterModel(modelVersionId as string),
    enabled: !!modelVersionId,
  })
}

export function useStartMlFilterTraining() {
  return useMutation({ mutationFn: startMlFilterTraining })
}

export function useStartMlFilterComparison() {
  return useMutation({ mutationFn: startMlFilterComparison })
}

export function useStartMlFilterEvaluation() {
  return useMutation({ mutationFn: startMlFilterEvaluation })
}

type PollOptions = { pollMs?: number }

/** Server-owned progress: polling stops once the job reaches a terminal state. */
export function useMlFilterTrainingJob(jobId: string | null, { pollMs }: PollOptions = {}) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: mlFilterKeys.trainingJob(jobId ?? ''),
    queryFn: async () => {
      const status = await fetchMlFilterTrainingJob(jobId as string)
      if (status.status === 'completed') {
        void queryClient.invalidateQueries({ queryKey: [...mlFilterKeys.all, 'models'] })
      }
      return status
    },
    enabled: !!jobId,
    refetchInterval: (query) =>
      isMlFilterJobTerminal(query.state.data?.status) ? false : (pollMs ?? ML_FILTER_POLL_MS),
  })
}

export function useMlFilterComparisonJob(jobId: string | null, { pollMs }: PollOptions = {}) {
  return useQuery({
    queryKey: mlFilterKeys.comparisonJob(jobId ?? ''),
    queryFn: () => fetchMlFilterComparisonJob(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) =>
      isMlFilterJobTerminal(query.state.data?.status) ? false : (pollMs ?? ML_FILTER_POLL_MS),
  })
}

export function useMlFilterEvaluationJob(jobId: string | null, { pollMs }: PollOptions = {}) {
  return useQuery({
    queryKey: mlFilterKeys.evaluationJob(jobId ?? ''),
    queryFn: () => fetchMlFilterEvaluationJob(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) =>
      isMlFilterJobTerminal(query.state.data?.status) ? false : (pollMs ?? ML_FILTER_POLL_MS),
  })
}
