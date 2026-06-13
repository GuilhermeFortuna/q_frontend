import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router'

import { AppShell } from '@/components/layout/AppShell'
import { BacktestsWorkspace } from '@/workspaces/backtests/BacktestsWorkspace'
import { DiscoverWorkspace } from '@/workspaces/discover/DiscoverWorkspace'
import { LauncherWorkspace } from '@/workspaces/launcher/LauncherWorkspace'
import { MarketDataWorkspace } from '@/workspaces/market-data/MarketDataWorkspace'
import { NewsReaderWorkspace } from '@/workspaces/news/NewsReaderWorkspace'
import { OptimizeWorkspace } from '@/workspaces/optimize/OptimizeWorkspace'
import { SystemWorkspace } from '@/workspaces/system/SystemWorkspace'
import { WalkForwardWorkspace } from '@/workspaces/walkforward/WalkForwardWorkspace'
import { useAppStore } from '@/store/useAppStore'
import type { WorkspaceId } from '@/types/api'

function syncWorkspace(workspace: WorkspaceId) {
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
  beforeLoad: () => syncWorkspace('launcher'),
  component: LauncherWorkspace,
})

const marketDataRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/market-data',
  beforeLoad: () => syncWorkspace('market-data'),
  component: MarketDataWorkspace,
})

const systemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/system',
  beforeLoad: () => syncWorkspace('system'),
  component: SystemWorkspace,
})

const researchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/research',
  beforeLoad: () => {
    syncWorkspace('research')
    throw redirect({ to: '/' })
  },
})

const backtestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/backtests',
  beforeLoad: () => syncWorkspace('backtests'),
  component: BacktestsWorkspace,
})

const optimizeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/optimize',
  beforeLoad: () => syncWorkspace('optimize'),
  component: OptimizeWorkspace,
})

const validateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/validate',
  beforeLoad: () => syncWorkspace('validate'),
  component: WalkForwardWorkspace,
})

const discoverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/discover',
  beforeLoad: () => syncWorkspace('discover'),
  component: DiscoverWorkspace,
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
    return <NewsReaderWorkspace id={search.id} showInlineClose={false} />
  },
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  marketDataRoute,
  systemRoute,
  researchRoute,
  backtestsRoute,
  optimizeRoute,
  validateRoute,
  discoverRoute,
  newsReaderRoute,
])

export const router = createRouter({
  routeTree,
  defaultViewTransition: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
