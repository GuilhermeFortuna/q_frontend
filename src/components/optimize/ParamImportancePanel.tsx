import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Bar, BarChart, LabelList, ResponsiveContainer } from 'recharts'

import { GlowCard } from '@/components/ui/spotlight-card'
import { chartTheme } from '@/lib/charts/chartTheme'
import {
  ThemedCartesianGrid,
  ThemedTooltip,
  ThemedXAxis,
  ThemedYAxis,
  chartMargin,
} from '@/lib/charts/rechartsTheme'
import { cn } from '@/lib/utils'
import type { OptimizationAnalytics, ParamImportanceEntry } from '@/types/optimization'

/** Matches WO113 backend `MIN_TRIALS` — keep copy in sync if that constant changes. */
const MIN_TRIALS_FOR_IMPORTANCE = 30

const CHART_MIN_HEIGHT_PX = 200

type ParamImportancePanelProps = {
  analytics: OptimizationAnalytics
}

function isActiveStudy(status: OptimizationAnalytics['status']) {
  return status === 'running' || status === 'pending'
}

function pendingMessage(analytics: OptimizationAnalytics): string {
  if (isActiveStudy(analytics.status)) {
    return 'Importance is computed once the search finishes.'
  }
  return `Not enough completed trials to rank importance (needs ≥ ${MIN_TRIALS_FOR_IMPORTANCE}).`
}

function sortEntries(entries: ParamImportanceEntry[]): ParamImportanceEntry[] {
  return [...entries].sort((a, b) => b.importance - a.importance)
}

export function ParamImportancePanel({ analytics }: ParamImportancePanelProps) {
  const { param_importances, objective_labels, is_multi_objective } = analytics
  const [selectedTarget, setSelectedTarget] = useState(objective_labels[0] ?? '')

  useEffect(() => {
    setSelectedTarget(objective_labels[0] ?? '')
  }, [analytics.study_id, objective_labels])

  const availableTargets = useMemo(() => {
    if (!param_importances) return objective_labels
    return objective_labels.filter((label) => param_importances[label]?.length)
  }, [objective_labels, param_importances])

  const showTargetToggle =
    is_multi_objective && availableTargets.length > 1 && param_importances !== null

  const series = useMemo(() => {
    if (!param_importances) return []
    const target = availableTargets.includes(selectedTarget) ? selectedTarget : availableTargets[0]
    return sortEntries(param_importances[target] ?? [])
  }, [availableTargets, param_importances, selectedTarget])

  if (param_importances === null) {
    return (
      <PanelFrame>
        <p className="text-silver-500 text-sm">{pendingMessage(analytics)}</p>
      </PanelFrame>
    )
  }

  if (series.length === 0) {
    return (
      <PanelFrame>
        <p className="text-silver-500 text-sm">
          Parameter importance is unavailable for this study.
        </p>
      </PanelFrame>
    )
  }

  return (
    <PanelFrame>
      {showTargetToggle ? (
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
          <span className="text-silver-500 text-xs">Target</span>
          <div className="border-carbon-600/60 flex gap-1 rounded-lg border p-1">
            {availableTargets.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setSelectedTarget(label)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  selectedTarget === label
                    ? 'bg-brass-600/20 text-brass-400'
                    : 'text-silver-400 hover:text-silver-200',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        className="min-h-0 w-full flex-1 overflow-hidden"
        style={{ minHeight: CHART_MIN_HEIGHT_PX }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={series}
            margin={{ ...chartMargin, right: 56, bottom: 8 }}
          >
            <ThemedCartesianGrid horizontal={false} />
            <ThemedXAxis type="number" domain={[0, 'auto']} />
            <ThemedYAxis type="category" dataKey="param" width={120} />
            <ThemedTooltip formatter={(value: number) => [value.toFixed(2), 'Importance']} />
            <Bar dataKey="importance" fill={chartTheme.semantic.equity} radius={[0, 4, 4, 0]}>
              <LabelList
                dataKey="importance"
                position="right"
                formatter={(value: number) => value.toFixed(2)}
                fill={chartTheme.axis.tick.fill}
                fontSize={chartTheme.axis.tick.fontSize}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </PanelFrame>
  )
}

function PanelFrame({ children }: { children: ReactNode }) {
  return (
    <GlowCard intensity="card" className="flex min-h-[160px] flex-col rounded-lg p-4">
      <h4 className="text-silver-200 mb-3 shrink-0 text-sm font-medium">Parameter Importance</h4>
      {children}
    </GlowCard>
  )
}
