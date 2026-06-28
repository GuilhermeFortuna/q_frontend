import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type {
  DiscoveryAbRequest,
  DiscoveryAbStartResponse,
  DiscoveryAbStatusResponse,
  EncoderAblationRequest,
  EncoderAblationStartResponse,
  EncoderAblationStatusResponse,
} from '@/types/experiments'

export const experimentKeys = {
  all: ['experiments'] as const,
  discoveryAb: (jobId: string) => [...experimentKeys.all, 'discoveryAb', jobId] as const,
  encoderAblation: (jobId: string) => [...experimentKeys.all, 'encoderAblation', jobId] as const,
}

// Discovery A/B harness
export async function startDiscoveryAb(
  request: DiscoveryAbRequest,
): Promise<DiscoveryAbStartResponse> {
  const { data } = await apiClient.post<DiscoveryAbStartResponse>(
    '/api/v1/experiments/discovery-ab',
    request,
  )
  return data
}

export async function fetchDiscoveryAbRun(jobId: string): Promise<DiscoveryAbStatusResponse> {
  const { data } = await apiClient.get<DiscoveryAbStatusResponse>(
    `/api/v1/experiments/discovery-ab/${jobId}`,
  )
  return data
}

export function useStartDiscoveryAb() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: startDiscoveryAb,
    onSuccess: (data) => {
      queryClient.setQueryData(experimentKeys.discoveryAb(data.job_id), undefined)
    },
  })
}

export function discoveryAbRunRefetchInterval(
  status: DiscoveryAbStatusResponse['status'] | undefined,
): number | false {
  return status === 'queued' || status === 'running' ? 1000 : false
}

export function useDiscoveryAbRun(jobId: string | null) {
  return useQuery({
    queryKey: experimentKeys.discoveryAb(jobId ?? ''),
    queryFn: () => fetchDiscoveryAbRun(jobId as string),
    enabled: !!jobId,
    staleTime: 500,
    refetchInterval: (query) => {
      if (!jobId) return false
      const status = query.state.data?.status
      if (status == null) return 1000
      return discoveryAbRunRefetchInterval(status)
    },
  })
}

// Encoder Ablation
export async function startEncoderAblation(
  request: EncoderAblationRequest,
): Promise<EncoderAblationStartResponse> {
  const { data } = await apiClient.post<EncoderAblationStartResponse>(
    '/api/v1/experiments/encoder-ablation',
    request,
  )
  return data
}

export async function fetchEncoderAblationRun(
  jobId: string,
): Promise<EncoderAblationStatusResponse> {
  const { data } = await apiClient.get<EncoderAblationStatusResponse>(
    `/api/v1/experiments/encoder-ablation/${jobId}`,
  )
  return data
}

export function useStartEncoderAblation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: startEncoderAblation,
    onSuccess: (data) => {
      queryClient.setQueryData(experimentKeys.encoderAblation(data.job_id), undefined)
    },
  })
}

export function encoderAblationRunRefetchInterval(
  status: EncoderAblationStatusResponse['status'] | undefined,
): number | false {
  return status === 'queued' || status === 'running' ? 1000 : false
}

export function useEncoderAblationRun(jobId: string | null) {
  return useQuery({
    queryKey: experimentKeys.encoderAblation(jobId ?? ''),
    queryFn: () => fetchEncoderAblationRun(jobId as string),
    enabled: !!jobId,
    staleTime: 500,
    refetchInterval: (query) => {
      if (!jobId) return false
      const status = query.state.data?.status
      if (status == null) return 1000
      return encoderAblationRunRefetchInterval(status)
    },
  })
}
