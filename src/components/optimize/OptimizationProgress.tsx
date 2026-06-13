import { Button } from '@/components/ui/button'
import { ActiveOutline } from '@/components/ui/ActiveOutline'
import type { OptimizationStatus } from '@/types/optimization'

type OptimizationProgressProps = {
  status: OptimizationStatus
  onCancel: () => void
  cancelling: boolean
}

export function OptimizationProgress({ status, onCancel, cancelling }: OptimizationProgressProps) {
  const pct =
    status.n_trials > 0
      ? Math.min(100, Math.round((status.completed_trials / status.n_trials) * 100))
      : 0

  return (
    <div className="animate-fade-in-up flex flex-1 flex-col items-center justify-center gap-4">
      <div className="quant-panel relative w-full max-w-md overflow-hidden rounded-2xl px-6 py-8 shadow-xl">
        <ActiveOutline />
        <div className="relative z-20">
          <div className="text-silver-300 mb-2.5 flex justify-between font-mono text-xs font-bold tracking-wide uppercase">
            <span>
              Progress: {status.completed_trials} / {status.n_trials} Trials
            </span>
            <span className="text-brass-400">{pct}%</span>
          </div>
          <div className="bg-carbon-950/85 border-brass-600/10 h-2.5 w-full overflow-hidden rounded-full border shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
            <div
              className="from-brass-600 to-brass-400 h-full rounded-full bg-gradient-to-r shadow-[0_0_12px_rgba(196,165,116,0.35)] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {status.best_value != null && (
            <p className="text-silver-400 mt-4 text-center text-xs font-medium tracking-wide">
              Best objective:{' '}
              <span className="text-brass-400 ml-1 font-mono text-sm font-bold">
                {status.best_value.toFixed(4)}
              </span>
            </p>
          )}
          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              className="text-silver-400 text-xs font-bold tracking-wider uppercase hover:text-red-400"
              onClick={onCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Job'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
