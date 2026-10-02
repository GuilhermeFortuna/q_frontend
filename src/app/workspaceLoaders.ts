import type { WorkspaceId } from '@/types/api'

export const loadLauncherWorkspace = () =>
  import('@/workspaces/launcher/LauncherWorkspace').then((module) => ({
    default: module.LauncherWorkspace,
  }))

export const loadMarketDataWorkspace = () =>
  import('@/workspaces/market-data/MarketDataWorkspace').then((module) => ({
    default: module.MarketDataWorkspace,
  }))

export const loadStorageWorkspace = () =>
  import('@/workspaces/storage/StorageWorkspace').then((module) => ({
    default: module.StorageWorkspace,
  }))

export const loadSystemWorkspace = () =>
  import('@/workspaces/system/SystemWorkspace').then((module) => ({
    default: module.SystemWorkspace,
  }))

export const loadBacktestsWorkspace = () =>
  import('@/workspaces/backtests/BacktestsWorkspace').then((module) => ({
    default: module.BacktestsWorkspace,
  }))

export const loadDiscoverWorkspace = () =>
  import('@/workspaces/discover/DiscoverWorkspace').then((module) => ({
    default: module.DiscoverWorkspace,
  }))

export const loadResearchWorkspace = () =>
  import('@/workspaces/research/ResearchWorkspace').then((module) => ({
    default: module.ResearchWorkspace,
  }))

export const loadStrategyBuilderWorkspace = () =>
  import('@/workspaces/strategy-builder/StrategyBuilderWorkspace').then((module) => ({
    default: module.StrategyBuilderWorkspace,
  }))

const WORKSPACE_LOADERS: Record<WorkspaceId, () => Promise<unknown>> = {
  launcher: loadLauncherWorkspace,
  'market-data': loadMarketDataWorkspace,
  storage: loadStorageWorkspace,
  backtests: loadBacktestsWorkspace,
  validate: loadBacktestsWorkspace,
  'strategy-builder': loadStrategyBuilderWorkspace,
  discover: loadDiscoverWorkspace,
  research: loadResearchWorkspace,
  system: loadSystemWorkspace,
}

/** Fetch a workspace chunk ahead of navigation so the route never suspends on it. */
export async function preloadWorkspace(id: WorkspaceId): Promise<void> {
  await WORKSPACE_LOADERS[id]()
}

/** Warm every workspace chunk one at a time; a failed chunk is retried on navigation. */
export async function preloadAllWorkspaces(): Promise<void> {
  for (const id of Object.keys(WORKSPACE_LOADERS) as WorkspaceId[]) {
    await preloadWorkspace(id).catch(() => undefined)
  }
}
