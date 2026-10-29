import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type { StrategyFileListResponse } from '../../../contracts/api'

export const strategyFileKeys = {
  all: ['strategy-files'] as const,
  list: () => [...strategyFileKeys.all, 'list'] as const,
}

export async function fetchStrategyFiles(): Promise<StrategyFileListResponse> {
  const { data } = await apiClient.get<StrategyFileListResponse>('/api/v1/strategy-files')
  return data
}

/**
 * Strategy files in the stack's strategy directory. The list refetches when the window regains
 * focus, so an edit in the author's editor shows up without a restart.
 */
export function useStrategyFiles() {
  return useQuery({
    queryKey: strategyFileKeys.list(),
    queryFn: fetchStrategyFiles,
    refetchOnWindowFocus: true,
  })
}
