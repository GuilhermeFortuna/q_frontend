import { Legend, Line, LineChart, ResponsiveContainer } from 'recharts'

import { stabilitySeries } from '@/components/research/featureScoringUtils'
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
import type { FeatureScoreRow } from '@/types/features'

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
            <LineChart data={chartData} margin={{ ...chartMargin, left: 0, bottom: 8 }}>
              <ThemedCartesianGrid />
              <ThemedXAxis dataKey="window" />
              <ThemedYAxis />
              <ThemedTooltip />
              <Legend />
              {rows.map((row, index) => (
                <Line
                  key={row.feature_id}
                  type="monotone"
                  dataKey={row.feature_name}
                  stroke={chartTheme.series.palette[index % chartTheme.series.palette.length]}
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
