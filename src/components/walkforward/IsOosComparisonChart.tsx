import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { CHART_COLORS } from '@/components/backtests/chartUtils'
import {
  formatObjectiveMetricValue,
  objectiveMetricLabel,
  objectiveMetricValue,
} from '@/lib/walkforward/objectiveMetric'
import type { ObjectiveMode } from '@/types/optimization'
import type { WalkForwardWindowResult } from '@/types/walkforward'

type IsOosComparisonChartProps = {
  windows: WalkForwardWindowResult[]
  objectiveMode: ObjectiveMode
}

export function IsOosComparisonChart({ windows, objectiveMode }: IsOosComparisonChartProps) {
  const chartData = useMemo(
    () =>
      windows.map((window) => ({
        label: `W${window.index + 1}`,
        is: objectiveMetricValue(window.is_metrics, objectiveMode),
        oos: objectiveMetricValue(window.oos_metrics, objectiveMode),
        status: window.status,
      })),
    [windows, objectiveMode],
  )

  if (chartData.length === 0) {
    return null
  }

  return (
    <div className="border-carbon-600/40 rounded-lg border bg-transparent p-4">
      <h4 className="text-silver-200 mb-3 text-sm font-medium">
        In-sample vs out-of-sample — {objectiveMetricLabel(objectiveMode)}
      </h4>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: CHART_COLORS.grid }}
            />
            <YAxis
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_COLORS.tooltipBg,
                border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                borderRadius: 6,
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [
                formatObjectiveMetricValue(value, objectiveMode),
                name === 'is' ? 'In-sample' : 'Out-of-sample',
              ]}
            />
            <Legend />
            <Bar dataKey="is" name="In-sample" fill="#c4a574" radius={[4, 4, 0, 0]} />
            <Bar dataKey="oos" name="Out-of-sample" fill="#6b9bd1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
