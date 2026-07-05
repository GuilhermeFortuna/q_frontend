import { useMemo } from 'react'
import { Bar, BarChart, Legend, ResponsiveContainer } from 'recharts'

import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { chartTheme } from '@/lib/charts/chartTheme'
import {
  ThemedCartesianGrid,
  ThemedTooltip,
  ThemedXAxis,
  ThemedYAxis,
  chartMargin,
} from '@/lib/charts/rechartsTheme'
import {
  formatObjectiveMetricValue,
  objectiveMetricLabel,
  objectiveMetricValue,
} from '@/lib/walkforward/objectiveMetric'
import type { ObjectiveMode } from '@/types/optimization'
import type { WalkForwardWindowResult } from '@/types/walkforward'

type AggregatedIsOosMetrics = {
  is_metrics: Record<string, number> | null
  oos_metrics: Record<string, number> | null
}

type IsOosComparisonChartProps = {
  windows: WalkForwardWindowResult[]
  objectiveMode: ObjectiveMode
  /** Single aggregated IS vs OOS bar pair (e.g. strategy-search candidate summary). */
  aggregatedSummary?: AggregatedIsOosMetrics
}

export function IsOosComparisonChart({
  windows,
  objectiveMode,
  aggregatedSummary,
}: IsOosComparisonChartProps) {
  const chartData = useMemo(() => {
    if (aggregatedSummary) {
      return [
        {
          label: 'Summary',
          is: objectiveMetricValue(aggregatedSummary.is_metrics, objectiveMode),
          oos: objectiveMetricValue(aggregatedSummary.oos_metrics, objectiveMode),
          status: 'completed' as const,
        },
      ]
    }

    return windows.map((window) => ({
      label: `W${window.index + 1}`,
      is: objectiveMetricValue(window.is_metrics, objectiveMode),
      oos: objectiveMetricValue(window.oos_metrics, objectiveMode),
      status: window.status,
    }))
  }, [aggregatedSummary, windows, objectiveMode])

  if (chartData.length === 0) {
    return null
  }

  return (
    <Panel className="p-4">
      <SectionHeader
        title={`In-sample vs out-of-sample — ${objectiveMetricLabel(objectiveMode)}`}
        className="mb-3"
      />
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={chartMargin}>
            <ThemedCartesianGrid vertical={false} />
            <ThemedXAxis dataKey="label" />
            <ThemedYAxis width={56} />
            <ThemedTooltip
              formatter={(value: number, name: string) => [
                formatObjectiveMetricValue(value, objectiveMode),
                name === 'is' ? 'In-sample' : 'Out-of-sample',
              ]}
            />
            <Legend />
            <Bar
              dataKey="is"
              name="In-sample"
              fill={chartTheme.semantic.equity}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="oos"
              name="Out-of-sample"
              fill={chartTheme.series.muted}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}
