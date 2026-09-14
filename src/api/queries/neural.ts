import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

import { apiClient } from '@/api/client'
import { useJobStream } from '@/lib/stream/jobStreamContext'
import { streamAwareRefetchInterval } from '@/lib/stream/jobQueryBridge'
import type {
  NeuralModelDetail,
  NeuralModelListResponse,
  NeuralModelStatus,
  NeuralModelStatusUpdateRequest,
  NeuralTrainRequest,
  NeuralTrainStartResponse,
  NeuralTrainingRun,
} from '@/types/neural'

export type NeuralModelListParams = {
  status?: NeuralModelStatus
}

export const neuralKeys = {
  all: ['neural'] as const,
  list: (params: NeuralModelListParams = {}) => [...neuralKeys.all, 'list', params] as const,
  version: (modelHash: string) => [...neuralKeys.all, 'version', modelHash] as const,
  trainingRun: (jobId: string) => [...neuralKeys.all, 'trainingRun', jobId] as const,
}

export async function fetchNeuralModels(
  params: NeuralModelListParams = {},
): Promise<NeuralModelListResponse> {
  const { data } = await apiClient.get<NeuralModelListResponse>('/api/v1/neural/models', {
    params,
  })
  return data
}

export async function fetchNeuralVersion(modelHash: string): Promise<NeuralModelDetail> {
  const { data } = await apiClient.get<NeuralModelDetail>(`/api/v1/neural/models/${modelHash}`)
  return data
}

export async function setNeuralModelStatus(
  modelHash: string,
  status: NeuralModelStatus,
): Promise<NeuralModelDetail> {
  const body: NeuralModelStatusUpdateRequest = { status }
  const { data } = await apiClient.post<NeuralModelDetail>(
    `/api/v1/neural/models/${modelHash}/status`,
    body,
  )
  return data
}

export function getNeuralStatusErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string' && detail.length > 0) {
      return detail
    }
    if (error.response?.status === 409) {
      return 'Illegal status transition.'
    }
  }
  return 'Failed to update neural model status.'
}

export function useNeuralModels(params: NeuralModelListParams = {}) {
  return useQuery({
    queryKey: neuralKeys.list(params),
    queryFn: () => fetchNeuralModels(params),
  })
}

export function useNeuralVersion(modelHash: string | null) {
  return useQuery({
    queryKey: neuralKeys.version(modelHash ?? ''),
    queryFn: () => fetchNeuralVersion(modelHash as string),
    enabled: !!modelHash,
  })
}

export async function startNeuralTraining(
  request: NeuralTrainRequest,
): Promise<NeuralTrainStartResponse> {
  const { data } = await apiClient.post<NeuralTrainStartResponse>(
    '/api/v1/neural/models/train',
    request,
  )
  return data
}

export async function fetchNeuralTrainingRun(jobId: string): Promise<NeuralTrainingRun> {
  const { data } = await apiClient.get<NeuralTrainingRun>(`/api/v1/neural/models/train/${jobId}`)
  return data
}

export function neuralTrainingRunRefetchInterval(isRunning: boolean): number | false {
  return isRunning ? 800 : false
}

export function useStartNeuralTraining() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: startNeuralTraining,
    onSuccess: (data) => {
      queryClient.setQueryData(neuralKeys.trainingRun(data.job_id), undefined)
    },
  })
}

export function useNeuralTrainingRun(jobId: string | null, { isRunning }: { isRunning: boolean }) {
  useJobStream()
  return useQuery({
    queryKey: neuralKeys.trainingRun(jobId ?? ''),
    queryFn: () => fetchNeuralTrainingRun(jobId as string),
    enabled: !!jobId,
    staleTime: 500,
    refetchInterval: streamAwareRefetchInterval('neural_training', () =>
      neuralTrainingRunRefetchInterval(isRunning),
    ),
  })
}

export function useSetNeuralModelStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ modelHash, status }: { modelHash: string; status: NeuralModelStatus }) =>
      setNeuralModelStatus(modelHash, status),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(neuralKeys.version(variables.modelHash), data)
      queryClient.invalidateQueries({ queryKey: [...neuralKeys.all, 'list'] })
      queryClient.invalidateQueries({ queryKey: neuralKeys.version(variables.modelHash) })
    },
  })
}
