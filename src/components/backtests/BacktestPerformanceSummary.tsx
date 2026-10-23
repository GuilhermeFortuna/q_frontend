import { useState } from 'react'

import { SectionHeader } from '@/components/ui/SectionHeader'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { Tooltip } from '@/components/ui/Tooltip'
import { GlowCard } from '@/components/ui/spotlight-card'
import { cn } from '@/lib/utils'
import {
  buildPerformanceMetricGroups,
  type MetricTone,
  type PerformanceSide,
} from '@/lib/backtesting/performanceSummary'
import type { BacktestPerformance } from '@/types/backtesting'

const SIDE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'long', label: 'Long' },
  { value: 'short', label: 'Short' },
] as const

const toneClasses: Record<MetricTone, string> = {
  positive: 'text-emerald-400',
  negative: 'text-rose-400',
  neutral: 'text-silver-100',
}

function MetricValue({
  label,
  value,
  tooltip,
  tone,
}: {
  label: string
  value: string
  tooltip: string
  tone: MetricTone
}) {
  return (
    <div className="border-carbon-700/40 flex min-w-0 items-baseline justify-between gap-3 border-b py-1.5 last:border-0">
      <dt className="text-silver-400 min-w-0 truncate text-xs">
        <Tooltip content={tooltip}>
          <span
            tabIndex={0}
            className="focus-visible:outline-brass-500 cursor-help decoration-dotted underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-1"
          >
            {label}
          </span>
        </Tooltip>
      </dt>
      <dd
        className={cn(
          'shrink-0 text-right font-mono text-xs font-semibold tabular-nums',
          toneClasses[tone],
        )}
      >
        {value}
      </dd>
    </div>
  )
}

export function BacktestPerformanceSummary({ performance }: { performance: BacktestPerformance }) {
  const [side, setSide] = useState<PerformanceSide>('all')
  const groups = buildPerformanceMetricGroups(performance, side)

  return (
    <section aria-label="Performance metrics" className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      {groups.map((group) => (
        <GlowCard
          key={group.title}
          intensity="card"
          className="border-carbon-700/50 bg-carbon-900/35 rounded-xl border p-4"
        >
          <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
            <SectionHeader title={group.title} />
            {group.title === 'Trade quality' ? (
              <SegmentedToggle
                aria-label="Trade quality side"
                options={[...SIDE_OPTIONS]}
                value={side}
                onChange={setSide}
                className="shrink-0"
              />
            ) : null}
          </div>
          {group.title !== 'Trade quality' ? (
            <p className="text-silver-500 mb-2 text-[10px] leading-relaxed">{group.description}</p>
          ) : null}
          <dl aria-label={`${group.title} metrics`}>
            {group.rows.map((metric) => (
              <MetricValue key={metric.label} {...metric} />
            ))}
          </dl>
        </GlowCard>
      ))}
    </section>
  )
}
