import { MorphingDialog } from '@/components/ui/MorphingDialog'
import { CandidateDetailPanel } from '@/components/discover/CandidateDetailPanel'
import { gateFlagsLabel } from '@/lib/discover/candidateMetrics'
import {
  formatObjectiveMetricValue,
  objectiveMetricLabel,
} from '@/lib/walkforward/objectiveMetric'
import { cn } from '@/lib/utils'
import type { ObjectiveMode, OptimizationBacktestConfig } from '@/types/optimization'
import type { CandidateResult, StrategySearchConfig } from '@/types/strategySearch'

export function candidateMorphLayoutId(candidateId: string): string {
  return `discover-candidate-${candidateId}`
}

function GateBadge({ candidate }: { candidate: CandidateResult }) {
  const passed = candidate.passed_gates && candidate.status === 'completed'
  const label = passed ? 'Passed' : candidate.status === 'completed' ? 'Flagged' : candidate.status

  return (
    <span
      title={gateFlagsLabel(candidate.gate_flags)}
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
        passed
          ? 'bg-emerald-500/10 text-emerald-400'
          : candidate.status === 'completed'
            ? 'bg-amber-500/10 text-amber-300'
            : 'bg-silver-500/10 text-silver-400',
      )}
    >
      {label}
    </span>
  )
}

export type CandidateMorphingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidate: CandidateResult
  runId: string
  backtest: OptimizationBacktestConfig
  objectiveMode: ObjectiveMode
  searchConfig: StrategySearchConfig | undefined
  onCloseAutoFocus?: (event: Event) => void
  onExitComplete?: () => void
}

/**
 * Discover candidate inspector: row identity summary morphs into a surface-overlay shell that
 * mounts the existing CandidateDetailPanel without duplicating metrics or queries.
 */
export function CandidateMorphingDialog({
  open,
  onOpenChange,
  candidate,
  runId,
  backtest,
  objectiveMode,
  searchConfig,
  onCloseAutoFocus,
  onExitComplete,
}: CandidateMorphingDialogProps) {
  const layoutId = candidateMorphLayoutId(candidate.candidate_id)
  const objectiveLabel = objectiveMetricLabel(objectiveMode)
  const objectiveValue = formatObjectiveMetricValue(candidate.objective_value, objectiveMode)
  const rankLabel = candidate.rank != null ? `#${candidate.rank}` : 'Unranked'

  return (
    <MorphingDialog
      open={open}
      onOpenChange={onOpenChange}
      layoutId={layoutId}
      title="Candidate"
      description={`${rankLabel} · ${candidate.strategy} · ${objectiveLabel} ${objectiveValue}`}
      onCloseAutoFocus={onCloseAutoFocus}
      onExitComplete={onExitComplete}
      contentClassName="max-w-4xl"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 gap-y-1.5">
        <span className="text-silver-400 quant-tabular-nums font-mono font-sans text-xs">
          {rankLabel}
        </span>
        <span className="text-silver-100 text-sm font-medium">{candidate.strategy}</span>
        <span className="text-silver-400 text-xs">
          {objectiveLabel}{' '}
          <span className="text-silver-200 quant-tabular-nums font-mono font-sans">
            {objectiveValue}
          </span>
        </span>
        <span className="text-silver-500 text-xs capitalize">{candidate.status}</span>
        <GateBadge candidate={candidate} />
      </div>

      {open ? (
        <CandidateDetailPanel
          key={candidate.candidate_id}
          runId={runId}
          candidate={candidate}
          backtest={backtest}
          objectiveMode={objectiveMode}
          searchConfig={searchConfig}
        />
      ) : null}
    </MorphingDialog>
  )
}
