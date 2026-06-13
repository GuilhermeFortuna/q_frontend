import { Button } from '@/components/ui/button'
import { ActiveOutline } from '@/components/ui/ActiveOutline'
import type { StrategySearchStatus } from '@/types/strategySearch'

type DiscoverProgressProps = {
  status: StrategySearchStatus
  onCancel: () => void
  cancelling: boolean
}

function phaseLabel(phase: StrategySearchStatus['phase']): string {
  if (phase === 'optimizing') return 'optimizing'
  if (phase === 'testing') return 'testing'
  if (phase === 'done') return 'done'
  return 'working'
}

export function DiscoverProgress({ status, onCancel, cancelling }: DiscoverProgressProps) {
  const total = Math.max(status.total_candidates, 1)
  const current = status.current_candidate
  const pct = Math.min(100, Math.round((current / total) * 100))

  const hasLiveDetail =
    status.phase != null &&
    status.strategy != null &&
    status.window_index != null &&
    status.total_windows != null

  const headerLabel =
    status.total_candidates > 0
      ? hasLiveDetail
        ? `Candidate ${Math.min(current, status.total_candidates)} / ${status.total_candidates} — ${status.strategy} — window ${status.window_index! + 1}/${status.total_windows} ${phaseLabel(status.phase)}`
        : `Candidate ${Math.min(current, status.total_candidates)} / ${status.total_candidates}${
            status.strategy ? ` — ${status.strategy}` : ''
          }`
      : 'Preparing search…'

  return (
    <div className="animate-fade-in-up flex flex-1 flex-col items-center justify-center gap-4">
      <div className="quant-panel relative w-full max-w-md overflow-hidden rounded-2xl px-6 py-8 shadow-xl">
        <ActiveOutline />
        <div className="relative z-20">
          <p className="text-silver-200 mb-1 text-center text-sm font-medium">{headerLabel}</p>
          {!hasLiveDetail && status.status === 'running' ? (
            <p className="text-silver-500 mb-3 text-center text-xs">
              Live window phase unavailable — showing persisted candidate progress after restart.
            </p>
          ) : null}
          <div className="text-silver-300 mb-2.5 flex justify-between font-mono text-xs font-bold tracking-wide uppercase">
            <span>
              Candidates: {current} / {status.total_candidates}
            </span>
            <span className="text-brass-400">{pct}%</span>
          </div>
          <div className="bg-carbon-950/85 border-brass-600/10 h-2.5 w-full overflow-hidden rounded-full border shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
            <div
              className="from-brass-600 to-brass-400 h-full rounded-full bg-gradient-to-r shadow-[0_0_12px_rgba(196,165,116,0.35)] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {hasLiveDetail ? (
            <div className="text-silver-400 mt-4 text-center text-xs">
              Window {status.window_index! + 1} / {status.total_windows} —{' '}
              {phaseLabel(status.phase)}
            </div>
          ) : null}
          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              className="text-silver-400 text-xs font-bold tracking-wider uppercase hover:text-red-400"
              onClick={onCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Search'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
