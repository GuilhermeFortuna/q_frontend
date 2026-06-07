import { useMutation } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type { BacktestRequest, BacktestResponse } from '@/types/backtesting'

export const backtestKeys = {
  all: ['backtests'] as const,
}

export async function runBacktest(request: BacktestRequest): Promise<BacktestResponse> {
  const { data } = await apiClient.post<BacktestResponse>('/api/v1/backtest/run', request)
  return data
}

export function useRunBacktest() {
  return useMutation({
    mutationKey: backtestKeys.all,
    mutationFn: runBacktest,
  })
}
