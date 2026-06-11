import { Button } from '@/components/ui/button'
import type { WalkForwardStatus } from '@/types/walkforward'

type WalkForwardProgressProps = {
  status: WalkForwardStatus
  onCancel: () => void
  cancelling: boolean
}

function phaseLabel(phase: WalkForwardStatus['phase']): string {
  if (phase === 'optimizing') return 'optimizing'
  if (phase === 'testing') return 'testing OOS'
  return 'working'
}

export function WalkForwardProgress({ status, onCancel, cancelling }: WalkForwardProgressProps) {
  const total = Math.max(status.total_windows, 1)
  const completed = status.windows_completed
  const pct = Math.min(100, Math.round((completed / total) * 100))
  const windowLabel =
    status.total_windows > 0
      ? `Window ${Math.min(status.current_window + 1, status.total_windows)} / ${status.total_windows}`
      : 'Preparing windows…'
  const phase = status.phase ? phaseLabel(status.phase) : 'resumed from history'

  return (
    <div className="animate-fade-in-up flex flex-1 flex-col items-center justify-center gap-4">
      <div className="quant-panel w-full max-w-md rounded-2xl px-6 py-8 shadow-xl">
        <p className="text-silver-200 mb-1 text-center text-sm font-medium">
          {windowLabel} — {phase}
        </p>
        {!status.phase && status.status === 'running' ? (
          <p className="text-silver-500 mb-3 text-center text-xs">
            Live phase unavailable — showing persisted window progress after restart.
          </p>
        ) : null}
        <div className="text-silver-300 mb-2.5 flex justify-between font-mono text-xs font-bold tracking-wide uppercase">
          <span>
            Windows completed: {completed} / {status.total_windows}
          </span>
          <span className="text-brass-400">{pct}%</span>
        </div>
        <div className="bg-carbon-950/85 border-brass-600/10 h-2.5 w-full overflow-hidden rounded-full border shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
          <div
            className="from-brass-600 to-brass-400 h-full rounded-full bg-gradient-to-r shadow-[0_0_12px_rgba(196,165,116,0.35)] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-6 flex justify-center">
          <Button
            type="button"
            variant="ghost"
            className="text-silver-400 text-xs font-bold tracking-wider uppercase hover:text-red-400"
            onClick={onCancel}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Run'}
          </Button>
        </div>
      </div>
    </div>
  )
}
