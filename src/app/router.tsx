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
  LazyExecutionWorkspace,
  LazyLauncherWorkspace,
  LazyMarketDataWorkspace,
  LazyNewsReaderWorkspace,
  LazyResearchWorkspace,
  LazyStorageWorkspace,
  LazySystemWorkspace,
  LazyStrategyBuilderWorkspace,
} from '@/app/lazyWorkspaces'
import { LazyDevUiGallery } from '@/app/lazyDev'
import { LazyRouteBoundary } from '@/components/islands/LazyRouteBoundary'
import { AppShell } from '@/components/layout/AppShell'
import { useAppStore } from '@/store/useAppStore'
import type { WorkspaceId } from '@/types/api'
import type { ResearchTab } from '@/types/features'

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
      const active = useAppStore.getState().activeWorkspace
      if (active && active !== 'launcher') {
        if (active === 'validate') {
          useAppStore.getState().setActiveWorkspace('backtests')
          useAppStore.getState().patchBacktestSession({ workflowMode: 'validate' })
          throw redirect({ to: '/backtests', search: { mode: 'validate' } })
        }
        if ((active as string) === 'optimize') {
          useAppStore.getState().setActiveWorkspace('backtests')
          useAppStore.getState().patchBacktestSession({ workflowMode: 'optimize' })
          throw redirect({ to: '/backtests', search: { mode: 'optimize' } })
        }
        if ((active as string) === 'strategy' || active === 'strategy-builder') {
          useAppStore.getState().setActiveWorkspace('strategy-builder')
          throw redirect({ to: '/strategy-builder' })
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
  mode?: 'optimize' | 'validate'
}

const backtestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/backtests',
  validateSearch: (search: Record<string, unknown>): BacktestsSearch => ({
    mode:
      search.mode === 'optimize' ? 'optimize' : search.mode === 'validate' ? 'validate' : undefined,
  }),
  beforeLoad: ({ search }) => {
    syncWorkspace('backtests')
    if (search.mode === 'optimize') {
      useAppStore.getState().patchBacktestSession({ workflowMode: 'optimize' })
    } else if (search.mode === 'validate') {
      useAppStore.getState().patchBacktestSession({ workflowMode: 'validate' })
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
  beforeLoad: () => {
    useAppStore.getState().patchBacktestSession({ workflowMode: 'validate' })
    throw redirect({ to: '/backtests', search: { mode: 'validate' } })
  },
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

type ResearchSearch = {
  tab?: ResearchTab
}

function parseResearchTab(value: unknown): ResearchTab {
  if (
    value === 'scoring' ||
    value === 'lab' ||
    value === 'store' ||
    value === 'neural' ||
    value === 'experiments'
  ) {
    return value
  }
  return 'store'
}

const researchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/research',
  validateSearch: (search: Record<string, unknown>): ResearchSearch => ({
    tab: parseResearchTab(search.tab),
  }),
  beforeLoad: () => syncWorkspace('research'),
  component: () => {
    const search = researchRoute.useSearch()
    return (
      <LazyRouteBoundary label="Loading research">
        <LazyResearchWorkspace tab={search.tab ?? 'store'} />
      </LazyRouteBoundary>
    )
  },
})

const executionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/execution',
  beforeLoad: () => syncWorkspace('execution'),
  component: () => (
    <LazyRouteBoundary label="Loading execution">
      <LazyExecutionWorkspace />
    </LazyRouteBoundary>
  ),
})

const strategyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/strategy',
  beforeLoad: () => {
    throw redirect({ to: '/strategy-builder' })
  },
})

const strategyBuilderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/strategy-builder',
  beforeLoad: () => syncWorkspace('strategy-builder'),
  component: () => (
    <LazyRouteBoundary label="Loading strategy builder">
      <LazyStrategyBuilderWorkspace />
    </LazyRouteBoundary>
  ),
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
  researchRoute,
  executionRoute,
  newsReaderRoute,
  strategyRoute,
  strategyBuilderRoute,
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
  defaultViewTransition: {
    types: ({ fromLocation, toLocation }) => {
      const PATH_ORDER = [
        '/',
        '/market-data',
        '/storage',
        '/strategy-builder',
        '/backtests',
        '/validate',
        '/discover',
        '/research',
        '/execution',
        '/system',
      ]
      const fromIndex = fromLocation ? PATH_ORDER.indexOf(fromLocation.pathname) : -1
      const toIndex = toLocation ? PATH_ORDER.indexOf(toLocation.pathname) : -1

      if (fromIndex !== -1 && toIndex !== -1) {
        if (toIndex > fromIndex) {
          return ['forward']
        } else if (toIndex < fromIndex) {
          return ['backward']
        }
      }
      return []
    },
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
