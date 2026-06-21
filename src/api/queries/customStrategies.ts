import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type { CustomStrategy } from '@/types/strategies'
import { strategyKeys } from '@/api/queries/strategies'

export const customStrategyKeys = {
  all: ['custom-strategies'] as const,
  list: () => [...customStrategyKeys.all, 'list'] as const,
}

export async function fetchCustomStrategies(): Promise<CustomStrategy[]> {
  const { data } = await apiClient.get<CustomStrategy[]>('/api/v1/strategies/custom')
  return data
}

export function useCustomStrategies() {
  return useQuery({
    queryKey: customStrategyKeys.list(),
    queryFn: fetchCustomStrategies,
  })
}

export function useSaveCustomStrategy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (strategy: CustomStrategy) => {
      const { data } = await apiClient.post('/api/v1/strategies/custom', strategy)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customStrategyKeys.list() })
      queryClient.invalidateQueries({ queryKey: strategyKeys.list() })
    },
  })
}

export function useDeleteCustomStrategy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await apiClient.delete(`/api/v1/strategies/custom/${name}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customStrategyKeys.list() })
      queryClient.invalidateQueries({ queryKey: strategyKeys.list() })
    },
  })
}
