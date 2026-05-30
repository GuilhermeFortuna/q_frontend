import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type { SystemHealth } from '@/types/api'

export const systemKeys = {
  all: ['system'] as const,
  health: () => [...systemKeys.all, 'health'] as const,
}

async function fetchSystemHealth(): Promise<SystemHealth> {
  const { data } = await apiClient.get<SystemHealth>('/api/v1/system/health')
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
