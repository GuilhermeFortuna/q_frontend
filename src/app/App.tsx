import { useMemo } from 'react'
import { RouterProvider } from '@tanstack/react-router'

import { AppProviders } from '@/app/providers'
import { LazyNewsReaderWorkspace, LazyStandaloneChartWindow } from '@/app/lazyWorkspaces'
import { router } from '@/app/router'
import { LazyRouteBoundary } from '@/components/islands/LazyRouteBoundary'
import { ReaderWindowShell } from '@/components/layout/ReaderWindowShell'
import { useGlobalZoom } from '@/hooks/useGlobalZoom'

export function App() {
  useGlobalZoom()

  const newsId = useMemo(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    return params.get('news_id')
  }, [])

  const runId = useMemo(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    return params.get('run_id')
  }, [])

  if (newsId) {
    return (
      <AppProviders>
        <ReaderWindowShell>
          <LazyRouteBoundary label="Loading reader">
            <LazyNewsReaderWorkspace id={newsId} showInlineClose={false} />
          </LazyRouteBoundary>
        </ReaderWindowShell>
      </AppProviders>
    )
  }

  if (runId) {
    return (
      <AppProviders>
        <LazyRouteBoundary label="Loading chart">
          <LazyStandaloneChartWindow runId={runId} />
        </LazyRouteBoundary>
      </AppProviders>
    )
  }

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
