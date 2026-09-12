import { AlertCircle } from 'lucide-react'

import { FaultyTerminalField } from '@/components/status/FaultyTerminalField'
import { cn } from '@/lib/utils'

export type OperationalFailureStateProps = {
  title: string
  description: string
  code?: string
  onRetry?: () => void
  compact?: boolean
  testId?: string
  className?: string
}

/**
 * Presentation-only surface for genuine system unavailability.
 * Parents decide error policy and retry behavior (WO219 / P-005).
 */
export function OperationalFailureState({
  title,
  description,
  code,
  onRetry,
  compact = false,
  testId = 'operational-failure-state',
  className,
}: OperationalFailureStateProps) {
  return (
    <div
      role="alert"
      data-testid={testId}
      data-compact={compact ? 'true' : 'false'}
      className={cn(
        'border-carbon-700 relative flex w-full flex-col items-center justify-center overflow-hidden rounded-lg border',
        compact ? 'min-h-[240px] gap-2.5 px-4 py-6' : 'h-full min-h-[280px] gap-3 px-6 py-10',
        className,
      )}
    >
      <FaultyTerminalField />
      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        <AlertCircle
          className={cn('mb-2 shrink-0 text-rose-400', compact ? 'h-5 w-5' : 'h-6 w-6')}
          aria-hidden
        />
        <h3
          className={cn(
            'text-silver-100 font-semibold tracking-wide',
            compact ? 'text-sm' : 'text-base',
          )}
        >
          {title}
        </h3>
        <p
          className={cn('text-silver-300 mt-1.5 leading-relaxed', compact ? 'text-xs' : 'text-sm')}
        >
          {description}
        </p>
        {code ? (
          <p className="text-silver-500 mt-2 font-mono text-[11px] tracking-wider uppercase">
            {code}
          </p>
        ) : null}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="border-brass-500/50 text-brass-300 hover:bg-brass-500/10 focus-visible:ring-brass-500/60 mt-4 rounded-md border px-3 py-1.5 text-xs font-medium tracking-wide uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  )
}
