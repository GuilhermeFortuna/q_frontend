import { useEffect } from 'react'

import { AiStrategyPanel } from '@/components/backtests/setup/AiStrategyPanel'
import type { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { useAiStrategySession } from '@/lib/strategies/useAiStrategySession'
import type { BacktestRequest } from '@/types/backtesting'

type BacktestConfig = ReturnType<typeof useBacktestConfig>

type AiStrategyIslandProps = {
  config: BacktestConfig
  onRunBacktest: (request: BacktestRequest) => void
  onWorkflowBlockerChange?: (blocker: string | null) => void
}

export function AiStrategyIsland({
  config,
  onRunBacktest,
  onWorkflowBlockerChange,
}: AiStrategyIslandProps) {
  const session = useAiStrategySession({ config, onRunBacktest })

  useEffect(() => {
    onWorkflowBlockerChange?.(session.workflowBlocker)
  }, [onWorkflowBlockerChange, session.workflowBlocker])

  useEffect(() => {
    return () => {
      onWorkflowBlockerChange?.(null)
    }
  }, [onWorkflowBlockerChange])

  return <AiStrategyPanel session={session} />
}
