import { lazy } from 'react'

export const LazyLauncherWorkspace = lazy(() =>
  import('@/workspaces/launcher/LauncherWorkspace').then((module) => ({
    default: module.LauncherWorkspace,
  })),
)

export const LazyMarketDataWorkspace = lazy(() =>
  import('@/workspaces/market-data/MarketDataWorkspace').then((module) => ({
    default: module.MarketDataWorkspace,
  })),
)

export const LazyStorageWorkspace = lazy(() =>
  import('@/workspaces/storage/StorageWorkspace').then((module) => ({
    default: module.StorageWorkspace,
  })),
)

export const LazySystemWorkspace = lazy(() =>
  import('@/workspaces/system/SystemWorkspace').then((module) => ({
    default: module.SystemWorkspace,
  })),
)

export const LazyBacktestsWorkspace = lazy(() =>
  import('@/workspaces/backtests/BacktestsWorkspace').then((module) => ({
    default: module.BacktestsWorkspace,
  })),
)

export const LazyDiscoverWorkspace = lazy(() =>
  import('@/workspaces/discover/DiscoverWorkspace').then((module) => ({
    default: module.DiscoverWorkspace,
  })),
)

export const LazyResearchWorkspace = lazy(() =>
  import('@/workspaces/research/ResearchWorkspace').then((module) => ({
    default: module.ResearchWorkspace,
  })),
)

export const LazyWalkForwardWorkspace = lazy(() =>
  import('@/workspaces/walkforward/WalkForwardWorkspace').then((module) => ({
    default: module.WalkForwardWorkspace,
  })),
)

export const LazyNewsReaderWorkspace = lazy(() =>
  import('@/workspaces/news/NewsReaderWorkspace').then((module) => ({
    default: module.NewsReaderWorkspace,
  })),
)

export const LazyOptimizeWorkflow = lazy(() =>
  import('@/workspaces/backtests/OptimizeWorkflow').then((module) => ({
    default: module.OptimizeWorkflow,
  })),
)

export const LazyStandaloneChartWindow = lazy(() =>
  import('@/components/backtests/StandaloneChartWindow').then((module) => ({
    default: module.StandaloneChartWindow,
  })),
)
