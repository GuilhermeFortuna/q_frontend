import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router'

import { AppShell } from '@/components/layout/AppShell'
import { LauncherWorkspace } from '@/workspaces/launcher/LauncherWorkspace'
import { MarketDataWorkspace } from '@/workspaces/market-data/MarketDataWorkspace'
import { SystemWorkspace } from '@/workspaces/system/SystemWorkspace'
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

import { BacktestsWorkspace } from '@/workspaces/backtests/BacktestsWorkspace'

const backtestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/backtests',
  beforeLoad: () => syncWorkspace('backtests'),
  component: BacktestsWorkspace,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  marketDataRoute,
  systemRoute,
  researchRoute,
  backtestsRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
