import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type { StrategiesResponse } from '@/types/strategies'

export const strategyKeys = {
  all: ['strategies'] as const,
  list: () => [...strategyKeys.all, 'list'] as const,
}

export async function fetchStrategies(): Promise<StrategiesResponse> {
  const { data } = await apiClient.get<StrategiesResponse>('/api/v1/strategies')
  return data
}

export function useStrategies() {
  return useQuery({
    queryKey: strategyKeys.list(),
    queryFn: fetchStrategies,
    staleTime: Infinity,
  })
}
