import * as Sentry from '@sentry/react'
import { Component, type ReactNode } from 'react'

import { Button, Callout } from '@/components/ui'
import { Panel } from '@/components/ui/Panel'
import { isSentryEnabled } from '@/lib/observability/sentry'

type AppErrorBoundaryProps = {
  children: ReactNode
  onReload?: () => void
}

type LocalBoundaryState = { failed: boolean }

class LocalErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  LocalBoundaryState
> {
  state: LocalBoundaryState = { failed: false }

  static getDerivedStateFromError(): LocalBoundaryState {
    return { failed: true }
  }

  componentDidCatch() {
    // Deliberately local-only: reporting is disabled when this boundary is selected.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function AppErrorBoundary({
  children,
  onReload = () => window.location.reload(),
}: AppErrorBoundaryProps) {
  const fallback = (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Panel
        living
        className="w-full max-w-lg space-y-4 p-6"
        data-testid="app-error-boundary-fallback"
      >
        <Callout type="error" title="Application error">
          Something broke — the error was reported.
        </Callout>
        <Button type="button" variant="default" onClick={onReload}>
          Reload app
        </Button>
      </Panel>
    </main>
  )

  if (!isSentryEnabled()) {
    return <LocalErrorBoundary fallback={fallback}>{children}</LocalErrorBoundary>
  }

  return <Sentry.ErrorBoundary fallback={fallback}>{children}</Sentry.ErrorBoundary>
}
