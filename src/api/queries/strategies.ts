import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type { ExitRuleCatalogResponse, StrategiesResponse } from '@/types/strategies'

export const strategyKeys = {
  all: ['strategies'] as const,
  list: () => [...strategyKeys.all, 'list'] as const,
  exitRules: () => [...strategyKeys.all, 'exit-rules'] as const,
}

export async function fetchStrategies(): Promise<StrategiesResponse> {
  const { data } = await apiClient.get<StrategiesResponse>('/api/v1/strategies')
  return data
}

export async function fetchExitRuleCatalog(): Promise<ExitRuleCatalogResponse> {
  const { data } = await apiClient.get<ExitRuleCatalogResponse>('/api/v1/exit-rules')
  return data
}

export function useStrategies() {
  return useQuery({
    queryKey: strategyKeys.list(),
    queryFn: fetchStrategies,
    staleTime: Infinity,
  })
}

export function useExitRuleCatalog() {
  return useQuery({
    queryKey: strategyKeys.exitRules(),
    queryFn: fetchExitRuleCatalog,
    staleTime: Infinity,
  })
}
