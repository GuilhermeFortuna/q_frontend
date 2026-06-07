import { Button } from '@/components/ui/button'
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
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <div className="w-full max-w-md">
        <div className="text-silver-300 mb-2 flex justify-between text-sm">
          <span>
            Trial {status.completed_trials} / {status.n_trials}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="bg-carbon-800 h-2 w-full overflow-hidden rounded-full">
          <div
            className="bg-brass-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        {status.best_value != null && (
          <p className="text-silver-400 mt-3 text-center text-sm">
            Best so far: <span className="text-brass-400">{status.best_value.toFixed(4)}</span>
          </p>
        )}
        <div className="mt-5 flex justify-center">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={cancelling}>
            {cancelling ? 'Cancelling...' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  )
}
