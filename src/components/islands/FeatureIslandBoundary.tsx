import { Component, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type FeatureIslandBoundaryProps = {
  /** Label describing what failed to load, e.g. "performance charts". */
  label?: string
  /** Bumped on retry to force the lazy subtree to remount and re-fetch its chunk. */
  resetKey?: number
  onRetry?: () => void
  className?: string
  children: ReactNode
}

type FeatureIslandBoundaryState = {
  hasError: boolean
}

/**
 * Catches errors from lazy-loaded feature islands — most importantly a rejected
 * `import()` (e.g. a stale chunk after a Vite dev-server restart, or an
 * unreachable origin). Without this, a `<Suspense>` whose lazy child rejects
 * stays on its loading fallback forever. Shows a retry instead.
 */
export class FeatureIslandBoundary extends Component<
  FeatureIslandBoundaryProps,
  FeatureIslandBoundaryState
> {
  state: FeatureIslandBoundaryState = { hasError: false }

  static getDerivedStateFromError(): FeatureIslandBoundaryState {
    return { hasError: true }
  }

  componentDidUpdate(prevProps: FeatureIslandBoundaryProps) {
    // When the parent bumps resetKey (retry), clear the error so children remount.
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  componentDidCatch(error: Error) {
    console.error(`FeatureIsland "${this.props.label ?? 'feature'}" failed to load:`, error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={cn(
            'border-carbon-700/40 bg-carbon-950/30 flex min-h-[320px] flex-1 flex-col items-center justify-center gap-3 rounded-xl border',
            this.props.className,
          )}
          role="alert"
          data-testid="feature-island-error"
        >
          <p className="text-silver-300 text-sm">
            Couldn’t load {this.props.label ?? 'this view'}.
          </p>
          <button
            type="button"
            onClick={this.props.onRetry}
            className="border-brass-500/50 text-brass-300 hover:bg-brass-500/10 rounded-md border px-3 py-1.5 text-xs font-medium tracking-wide uppercase transition-colors"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
