import { Button } from '@/components/ui/button'
import { formatOptimizeSetupTeaserSummary } from '@/lib/optimize/configSummary'
import type { OptimizeConfigFields } from '@/lib/optimize/useOptimizeConfig'
import { cn } from '@/lib/utils'
import type { StrategyInfo } from '@/types/strategies'

type CollapsedOptimizeSetupTeaserProps = {
  fields: OptimizeConfigFields
  strategyInfo: StrategyInfo | undefined
  loading: boolean
  formInvalid: boolean
  strategiesLoading: boolean
  disabled: boolean
  onExpand: () => void
  onRun: () => void
}

const teaserButtonClass =
  'border-carbon-600/50 bg-carbon-950/50 hover:border-brass-500/35 focus-visible:ring-brass-500/40 flex w-full min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none'

export function CollapsedOptimizeSetupTeaser({
  fields,
  strategyInfo,
  loading,
  formInvalid,
  strategiesLoading,
  disabled,
  onExpand,
  onRun,
}: CollapsedOptimizeSetupTeaserProps) {
  const summary = formatOptimizeSetupTeaserSummary(fields, strategyInfo)

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        className={cn(teaserButtonClass, 'flex-1')}
        aria-expanded={false}
        aria-label="Expand setup"
        onClick={onExpand}
      >
        <span className="min-w-0 flex-1 text-xs leading-snug">
          <span className="text-brass-400 font-semibold">{summary.strategyLabel}</span>
          <span className="text-silver-500"> · </span>
          <span className="text-silver-300">{summary.paramsDigest}</span>
          <span className="text-silver-500"> · </span>
          <span className="text-silver-400">
            {summary.symbol} · {summary.timeframe} · {summary.range} · ${summary.capital}
          </span>
          <span className="text-silver-500"> · </span>
          <span className="text-silver-400">{summary.studyDigest}</span>
        </span>
      </button>
      <Button
        type="button"
        variant="brass"
        size="sm"
        disabled={loading || formInvalid || strategiesLoading || disabled}
        className="shrink-0"
        aria-label="Run optimization with current setup"
        onClick={(event) => {
          event.stopPropagation()
          onRun()
        }}
      >
        {loading ? 'Starting…' : 'Run'}
      </Button>
    </div>
  )
}
