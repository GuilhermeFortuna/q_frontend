import { Panel } from '@/components/ui/Panel'
import { cn } from '@/lib/utils'

type FeatureIslandFallbackProps = {
  /** Route-level fallbacks reserve the main workspace height; inline islands use a compact strip. */
  variant?: 'route' | 'inline' | 'pane'
  label?: string
  className?: string
}

export function FeatureIslandFallback({
  variant = 'route',
  label = 'Loading workspace',
  className,
}: FeatureIslandFallbackProps) {
  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'border-carbon-700/50 bg-carbon-950/40 flex min-h-[5.5rem] items-center gap-3 rounded-xl border px-4 py-3',
          className,
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
        data-testid="feature-island-fallback-inline"
      >
        <span className="border-brass-500/70 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-t-transparent" />
        <span className="text-silver-400 text-xs font-medium tracking-wide uppercase">{label}</span>
      </div>
    )
  }

  if (variant === 'pane') {
    return (
      <div
        className={cn(
          'border-carbon-700/40 bg-carbon-950/30 flex min-h-[320px] flex-1 flex-col items-center justify-center rounded-xl border',
          className,
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
        data-testid="feature-island-fallback-pane"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="border-brass-500/40 h-12 w-12 animate-spin rounded-full border-[3px] border-t-transparent" />
          <p className="text-silver-400 text-sm">{label}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'text-silver-100 flex min-h-[calc(100dvh-4.5rem-7rem)] w-full flex-col overflow-hidden',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="feature-island-fallback-route"
    >
      <Panel className="flex flex-1 flex-col overflow-hidden rounded-xl px-5 py-4">
        <div className="flex flex-1 flex-col items-center justify-center gap-5">
          <div className="relative">
            <div className="border-brass-500/25 h-16 w-16 animate-spin rounded-full border-[3px] border-t-transparent" />
            <div className="bg-brass-400/80 absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full" />
          </div>
          <div className="text-center">
            <p className="text-brass-400 text-xs font-semibold tracking-[0.2em] uppercase">
              {label}
            </p>
            <p className="text-silver-500 mt-1 text-xs">Preparing feature island…</p>
          </div>
          <div className="flex w-full max-w-md gap-2 px-6">
            <div className="bg-carbon-800/70 h-2 flex-1 animate-pulse rounded-full" />
            <div className="bg-carbon-800/50 h-2 w-24 animate-pulse rounded-full" />
          </div>
        </div>
      </Panel>
    </div>
  )
}
