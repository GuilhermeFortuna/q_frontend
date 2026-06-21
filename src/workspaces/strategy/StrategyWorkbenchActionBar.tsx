import { useNavigate } from '@tanstack/react-router'
import { Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { presetButtonActiveClass } from '@/components/shared/InstrumentConfigFields'
import { buildBacktestRequest } from '@/lib/backtesting/useBacktestConfig'
import { defaultBacktestEnd, defaultBacktestStart } from '@/lib/backtesting/dateRange'
import { defaultPositionSizingFields } from '@/lib/backtesting/positionSizing'
import { defaultTransactionCostFields } from '@/lib/backtesting/transactionCosts'
import type { StrategyParamValue } from '@/lib/strategies/strategyParams'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

type StrategyWorkbenchActionBarProps = {
  summary: string
  canSave: boolean
  isSaving: boolean
  onSave: () => void
  canBacktest: boolean
  baseStrategyName: string
  paramValues: Record<string, StrategyParamValue>
}

export function buildWorkbenchSummary(enabledExitCount: number, name: string): string {
  const parts = [`${enabledExitCount} exit${enabledExitCount === 1 ? '' : 's'} active`]
  if (!name.trim()) {
    parts.push('name required')
  }
  return parts.join(' · ')
}

export function StrategyWorkbenchActionBar({
  summary,
  canSave,
  isSaving,
  onSave,
  canBacktest,
  baseStrategyName,
  paramValues,
}: StrategyWorkbenchActionBarProps) {
  const navigate = useNavigate()
  const selectedSymbol = useAppStore((s) => s.selectedSymbol)
  const setPendingBacktestConfig = useAppStore((s) => s.setPendingBacktestConfig)
  const patchBacktestSession = useAppStore((s) => s.patchBacktestSession)

  const handleBacktest = () => {
    if (!canBacktest) return

    setPendingBacktestConfig(
      buildBacktestRequest({
        symbol: selectedSymbol,
        timeframe: 'D1',
        startDate: defaultBacktestStart,
        endDate: defaultBacktestEnd,
        capital: 100_000,
        pointValue: 1,
        sizingMode: 'fixed_quantity',
        positionSizingFields: defaultPositionSizingFields(),
        costFields: defaultTransactionCostFields(),
        strategy: baseStrategyName,
        strategyParams: paramValues,
        dayTrade: false,
        dayTradeStartTime: '09:00',
        dayTradeEndTime: '16:00',
        dayTradeCloseTime: '17:00',
        engine: 'candle',
        displayTimeframe: 'M1',
        tickFlags: 'all',
      }),
    )
    patchBacktestSession({
      workflowMode: 'backtest',
      focus: 'setup',
      rightPanelTab: 'results',
    })
    void navigate({ to: '/backtests' })
  }

  return (
    <div
      data-testid="workbench-action-bar"
      className="border-carbon-800/80 bg-carbon-950/95 supports-[backdrop-filter]:bg-carbon-950/85 sticky bottom-0 z-10 border-t px-4 py-3 backdrop-blur-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-silver-500 text-xs" data-testid="workbench-summary">
          {summary}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBacktest}
            disabled={!canBacktest}
            title={
              canBacktest
                ? 'Open Backtests with the current entry and exit parameters'
                : 'Select a base entry strategy to backtest'
            }
            className="gap-1.5 tracking-wider uppercase"
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            Backtest
          </Button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave || isSaving}
            className={cn(
              presetButtonActiveClass,
              'px-4 py-2 text-xs font-bold tracking-wider uppercase',
            )}
          >
            {isSaving ? 'Saving...' : 'Save Strategy'}
          </button>
        </div>
      </div>
    </div>
  )
}
