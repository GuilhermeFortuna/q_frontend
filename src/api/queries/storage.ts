import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type {
  IngestJob,
  IngestRequest,
  IngestStartResponse,
  StorageInventoryResponse,
  StorageKind,
} from '@/types/storage'
import { isIngestTerminalStatus } from '@/types/storage'

export const storageKeys = {
  all: ['storage'] as const,
  inventory: () => [...storageKeys.all, 'inventory'] as const,
  ingestStatus: (jobId: string) => [...storageKeys.all, 'ingest', jobId] as const,
}

async function fetchStorageInventory(): Promise<StorageInventoryResponse> {
  const { data } = await apiClient.get<StorageInventoryResponse>('/api/v1/storage/inventory')
  return data
}

async function startIngest(body: IngestRequest): Promise<IngestStartResponse> {
  const { data } = await apiClient.post<IngestStartResponse>('/api/v1/storage/ingest', body)
  return data
}

async function fetchIngestStatus(jobId: string): Promise<IngestJob> {
  const { data } = await apiClient.get<IngestJob>(`/api/v1/storage/ingest/${jobId}`)
  return data
}

async function deleteStorageSeries(
  symbol: string,
  kind: StorageKind,
  timeframe?: string,
): Promise<void> {
  const segment = kind === 'ticks' ? 'ticks' : encodeURIComponent((timeframe ?? '').toUpperCase())
  await apiClient.delete(`/api/v1/storage/${encodeURIComponent(symbol)}/${segment}`)
}

export function useStorageInventory() {
  return useQuery({
    queryKey: storageKeys.inventory(),
    queryFn: fetchStorageInventory,
    staleTime: 10_000,
  })
}

export function useStartIngest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: startIngest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.inventory() })
    },
  })
}

export function useIngestStatus(jobId: string | null) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: storageKeys.ingestStatus(jobId ?? ''),
    queryFn: () => fetchIngestStatus(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status && isIngestTerminalStatus(status)) {
        if (status === 'completed') {
          void queryClient.invalidateQueries({ queryKey: storageKeys.inventory() })
        }
        return false
      }
      return 1000
    },
  })
}

export type DeleteStorageInput = {
  symbol: string
  kind: StorageKind
  timeframe?: string
}

export function useDeleteStorage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ symbol, kind, timeframe }: DeleteStorageInput) =>
      deleteStorageSeries(symbol, kind, timeframe),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.inventory() })
    },
  })
}
