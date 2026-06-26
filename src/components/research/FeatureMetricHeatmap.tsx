import {
  divergingColor,
  heatmapCellValue,
  METRIC_COLUMNS,
  type MetricColumn,
} from '@/components/research/featureScoringUtils'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import type { FeatureEvalHeatmap } from '@/types/features'

type FeatureMetricHeatmapProps = {
  heatmap: FeatureEvalHeatmap
}

function formatMetricLabel(metric: string): string {
  return metric.replace(/_/g, ' ')
}

export function FeatureMetricHeatmap({ heatmap }: FeatureMetricHeatmapProps) {
  const metrics = heatmap.metrics.length > 0 ? heatmap.metrics : [...METRIC_COLUMNS]

  return (
    <Panel className="flex min-h-0 flex-col gap-3 p-4" data-testid="feature-metric-heatmap">
      <SectionHeader title="Metric heatmap" />
      <div className="overflow-auto">
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="text-silver-400 px-2 py-2 text-left font-bold tracking-wider uppercase">
                Feature
              </th>
              {metrics.map((metric) => (
                <th
                  key={metric}
                  className="text-silver-400 px-2 py-2 text-center font-bold tracking-wider uppercase"
                >
                  {formatMetricLabel(metric)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.rows.map((row) => (
              <tr key={row.feature_id} className="border-silver-800/60 border-t">
                <td className="text-cream-100 px-2 py-2 font-mono">{row.feature_name}</td>
                {metrics.map((metric) => {
                  const value = heatmapCellValue(row, metric)
                  const metricKey = metric as MetricColumn
                  return (
                    <td key={`${row.feature_id}-${metric}`} className="px-1 py-1">
                      <div
                        className="text-silver-100 rounded px-2 py-2 text-center font-mono"
                        style={{
                          backgroundColor: divergingColor(
                            value,
                            METRIC_COLUMNS.includes(metricKey) ? metricKey : 'stability',
                          ),
                        }}
                        data-testid={`heatmap-cell-${row.feature_name}-${metric}`}
                      >
                        {value === null ? '—' : value.toFixed(2)}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
