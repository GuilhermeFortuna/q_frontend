import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router'

import {
  LazyBacktestsWorkspace,
  LazyDiscoverWorkspace,
  LazyLauncherWorkspace,
  LazyMarketDataWorkspace,
  LazyNewsReaderWorkspace,
  LazyStorageWorkspace,
  LazySystemWorkspace,
  LazyWalkForwardWorkspace,
} from '@/app/lazyWorkspaces'
import { LazyDevUiGallery } from '@/app/lazyDev'
import { LazyRouteBoundary } from '@/components/islands/LazyRouteBoundary'
import { AppShell } from '@/components/layout/AppShell'
import { useAppStore } from '@/store/useAppStore'
import type { WorkspaceId } from '@/types/api'

let initialRedirectDone = false

function syncWorkspace(workspace: WorkspaceId) {
  initialRedirectDone = true
  useAppStore.getState().setActiveWorkspace(workspace)
}

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    if (!initialRedirectDone) {
      initialRedirectDone = true
      let active = useAppStore.getState().activeWorkspace
      if ((active as string) === 'research') {
        useAppStore.getState().setActiveWorkspace('launcher')
        active = 'launcher'
      }
      if (active && active !== 'launcher') {
        if (active === 'validate') {
          throw redirect({ to: '/validate' })
        }
        if ((active as string) === 'optimize') {
          useAppStore.getState().setActiveWorkspace('backtests')
          useAppStore.getState().patchBacktestSession({ workflowMode: 'optimize' })
          throw redirect({ to: '/backtests', search: { mode: 'optimize' } })
        }
        if ((active as string) === 'strategy') {
          useAppStore.getState().setActiveWorkspace('backtests')
          throw redirect({ to: '/backtests' })
        }
        throw redirect({ to: `/${active}` })
      }
    }
    syncWorkspace('launcher')
  },
  component: () => (
    <LazyRouteBoundary label="Loading launcher">
      <LazyLauncherWorkspace />
    </LazyRouteBoundary>
  ),
})

const marketDataRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/market-data',
  beforeLoad: () => syncWorkspace('market-data'),
  component: () => (
    <LazyRouteBoundary label="Loading market data">
      <LazyMarketDataWorkspace />
    </LazyRouteBoundary>
  ),
})

const storageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/storage',
  beforeLoad: () => syncWorkspace('storage'),
  component: () => (
    <LazyRouteBoundary label="Loading storage">
      <LazyStorageWorkspace />
    </LazyRouteBoundary>
  ),
})

const systemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/system',
  beforeLoad: () => syncWorkspace('system'),
  component: () => (
    <LazyRouteBoundary label="Loading system">
      <LazySystemWorkspace />
    </LazyRouteBoundary>
  ),
})

type BacktestsSearch = {
  mode?: 'optimize'
}

const backtestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/backtests',
  validateSearch: (search: Record<string, unknown>): BacktestsSearch => ({
    mode: search.mode === 'optimize' ? 'optimize' : undefined,
  }),
  beforeLoad: ({ search }) => {
    syncWorkspace('backtests')
    if (search.mode === 'optimize') {
      useAppStore.getState().patchBacktestSession({ workflowMode: 'optimize' })
    }
  },
  component: () => {
    const search = backtestsRoute.useSearch()
    return (
      <LazyRouteBoundary label="Loading backtests">
        <LazyBacktestsWorkspace initialMode={search.mode} />
      </LazyRouteBoundary>
    )
  },
})

const optimizeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/optimize',
  beforeLoad: () => {
    useAppStore.getState().patchBacktestSession({ workflowMode: 'optimize' })
    throw redirect({ to: '/backtests', search: { mode: 'optimize' } })
  },
})

const validateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/validate',
  beforeLoad: () => syncWorkspace('validate'),
  component: () => (
    <LazyRouteBoundary label="Loading validation">
      <LazyWalkForwardWorkspace />
    </LazyRouteBoundary>
  ),
})

const discoverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/discover',
  beforeLoad: () => syncWorkspace('discover'),
  component: () => (
    <LazyRouteBoundary label="Loading discovery">
      <LazyDiscoverWorkspace />
    </LazyRouteBoundary>
  ),
})

const strategyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/strategy',
  beforeLoad: () => {
    useAppStore.getState().setActiveWorkspace('backtests')
    throw redirect({ to: '/backtests' })
  },
})

type NewsReaderSearch = {
  id?: string
}

const newsReaderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/news-reader',
  validateSearch: (search: Record<string, unknown>): NewsReaderSearch => ({
    id: search.id as string | undefined,
  }),
  component: () => {
    const search = newsReaderRoute.useSearch()
    return (
      <LazyRouteBoundary label="Loading reader">
        <LazyNewsReaderWorkspace id={search.id} showInlineClose={false} />
      </LazyRouteBoundary>
    )
  },
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  marketDataRoute,
  storageRoute,
  systemRoute,
  backtestsRoute,
  optimizeRoute,
  validateRoute,
  discoverRoute,
  newsReaderRoute,
  strategyRoute,
  ...(import.meta.env.DEV
    ? [
        createRoute({
          getParentRoute: () => rootRoute,
          path: '/dev/ui',
          component: () => (
            <LazyRouteBoundary label="Loading UI gallery">
              <LazyDevUiGallery />
            </LazyRouteBoundary>
          ),
        }),
      ]
    : []),
])

export const router = createRouter({
  routeTree,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
