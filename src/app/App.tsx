import { useMemo } from 'react'
import { RouterProvider } from '@tanstack/react-router'

import { AppProviders } from '@/app/providers'
import { router } from '@/app/router'
import { useGlobalZoom } from '@/hooks/useGlobalZoom'
import { ReaderWindowShell } from '@/components/layout/ReaderWindowShell'
import { NewsReaderWorkspace } from '@/workspaces/news/NewsReaderWorkspace'
import { StandaloneChartWindow } from '@/components/backtests/StandaloneChartWindow'

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
          <NewsReaderWorkspace id={newsId} showInlineClose={false} />
        </ReaderWindowShell>
      </AppProviders>
    )
  }

  if (runId) {
    return (
      <AppProviders>
        <StandaloneChartWindow runId={runId} />
      </AppProviders>
    )
  }

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
