import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { CHART_COLORS } from '@/components/backtests/chartUtils'
import { stabilitySeries } from '@/components/research/featureScoringUtils'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import type { FeatureScoreRow } from '@/types/features'

const LINE_COLORS = ['#c4a574', '#4ade80', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa']

type FeatureStabilityPanelProps = {
  rows: FeatureScoreRow[]
}

export function FeatureStabilityPanel({ rows }: FeatureStabilityPanelProps) {
  const windows = new Set<string>()
  for (const row of rows) {
    for (const point of stabilitySeries(row)) {
      windows.add(point.window)
    }
  }

  const orderedWindows = [...windows]
  const chartData = orderedWindows.map((window) => {
    const point: Record<string, string | number> = { window }
    for (const row of rows) {
      const match = stabilitySeries(row).find((entry) => entry.window === window)
      point[row.feature_name] = match?.rank_ic ?? 0
    }
    return point
  })

  return (
    <Panel className="flex min-h-[280px] flex-col gap-3 p-4" data-testid="feature-stability-panel">
      <SectionHeader title="Stability over time" />
      {chartData.length === 0 ? (
        <p className="text-silver-400 text-sm">No stability windows available yet.</p>
      ) : (
        <div className="min-h-[220px] flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
              <XAxis
                dataKey="window"
                tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: CHART_COLORS.grid }}
              />
              <YAxis
                tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: CHART_COLORS.grid }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: CHART_COLORS.tooltipBg,
                  border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelStyle={{ color: CHART_COLORS.axis }}
              />
              <Legend />
              {rows.map((row, index) => (
                <Line
                  key={row.feature_id}
                  type="monotone"
                  dataKey={row.feature_name}
                  stroke={LINE_COLORS[index % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  )
}
