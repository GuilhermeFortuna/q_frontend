import { useMemo } from 'react'

import { formatSignedCurrency } from '@/components/backtests/chartUtils'
import { StatTile } from '@/components/ui/StatTile'
import { summarizeMonthlyStats } from '@/lib/backtesting/performance'
import type { MonthlyStats } from '@/types/backtesting'

type MonthlySummaryTilesProps = {
  monthlyStats: MonthlyStats[]
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function MonthlySummaryTiles({ monthlyStats }: MonthlySummaryTilesProps) {
  const summary = useMemo(() => summarizeMonthlyStats(monthlyStats), [monthlyStats])

  if (!summary) return null

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatTile
        label="Positive Months"
        value={`${summary.positiveMonths} of ${summary.totalMonths}`}
        delta={`${(summary.positiveMonthRate * 100).toFixed(1)}% of months`}
        deltaTone={summary.positiveMonthRate >= 0.5 ? 'up' : 'down'}
        valueTone={summary.positiveMonths > 0 ? 'up' : 'neutral'}
      />
      <StatTile
        label="Negative Months"
        value={`${summary.negativeMonths} of ${summary.totalMonths}`}
        delta={summary.flatMonths > 0 ? `${summary.flatMonths} flat` : undefined}
        valueTone={summary.negativeMonths > 0 ? 'down' : 'neutral'}
      />
      <StatTile
        label="Avg Monthly PnL"
        value={formatSignedCurrency(summary.averagePnl)}
        delta={`${summary.averageTradesPerMonth.toFixed(1)} trades / month`}
        valueTone={summary.averagePnl >= 0 ? 'up' : 'down'}
      />
      <StatTile
        label="Median Monthly PnL"
        value={formatSignedCurrency(summary.medianPnl)}
        valueTone={summary.medianPnl >= 0 ? 'up' : 'down'}
      />
      <StatTile
        label="Best Month"
        value={formatSignedCurrency(summary.bestMonth.pnl)}
        delta={summary.bestMonth.label}
        valueTone={summary.bestMonth.pnl >= 0 ? 'up' : 'down'}
      />
      <StatTile
        label="Worst Month"
        value={formatSignedCurrency(summary.worstMonth.pnl)}
        delta={summary.worstMonth.label}
        valueTone={summary.worstMonth.pnl >= 0 ? 'up' : 'down'}
      />
      <StatTile
        label="Longest Win Streak"
        value={pluralize(summary.longestWinStreak, 'month', 'months')}
        valueTone={summary.longestWinStreak > 0 ? 'up' : 'neutral'}
      />
      <StatTile
        label="Longest Loss Streak"
        value={pluralize(summary.longestLossStreak, 'month', 'months')}
        valueTone={summary.longestLossStreak > 0 ? 'down' : 'neutral'}
      />
    </div>
  )
}
