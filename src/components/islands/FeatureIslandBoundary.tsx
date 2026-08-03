import { Component, type ReactNode } from 'react'

import { OperationalFailureState } from '@/components/status/OperationalFailureState'
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
      const label = this.props.label ?? 'this view'
      return (
        <OperationalFailureState
          compact
          title="View unavailable"
          description={`Couldn’t load ${label}.`}
          onRetry={this.props.onRetry}
          testId="feature-island-error"
          className={cn('min-h-[320px] flex-1 rounded-xl', this.props.className)}
        />
      )
    }
    return this.props.children
  }
}
