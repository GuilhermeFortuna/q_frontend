import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type { SystemHealth } from '@/types/api'
import type { DataSourceMode, DataSourceSettings } from '@/types/storage'

export const systemKeys = {
  all: ['system'] as const,
  health: () => [...systemKeys.all, 'health'] as const,
  dataSource: () => [...systemKeys.all, 'data-source'] as const,
}

async function fetchSystemHealth(): Promise<SystemHealth> {
  const { data } = await apiClient.get<SystemHealth>('/api/v1/system/health')
  return data
}

async function fetchDataSource(): Promise<DataSourceSettings> {
  const { data } = await apiClient.get<DataSourceSettings>('/api/v1/system/data-source')
  return data
}

async function updateDataSource(source: DataSourceMode): Promise<DataSourceSettings> {
  const { data } = await apiClient.put<DataSourceSettings>('/api/v1/system/data-source', {
    source,
  })
  return data
}

export function useSystemHealth() {
  return useQuery({
    queryKey: systemKeys.health(),
    queryFn: fetchSystemHealth,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useDataSource() {
  return useQuery({
    queryKey: systemKeys.dataSource(),
    queryFn: fetchDataSource,
    staleTime: 10_000,
  })
}

export function useSetDataSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateDataSource,
    onSuccess: (data) => {
      queryClient.setQueryData(systemKeys.dataSource(), data)
      queryClient.invalidateQueries({ queryKey: systemKeys.health() })
    },
  })
}
