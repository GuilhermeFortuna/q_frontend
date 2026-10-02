import { lazy } from 'react'

import {
  loadBacktestsWorkspace,
  loadDiscoverWorkspace,
  loadLauncherWorkspace,
  loadMarketDataWorkspace,
  loadResearchWorkspace,
  loadStorageWorkspace,
  loadStrategyBuilderWorkspace,
  loadSystemWorkspace,
} from '@/app/workspaceLoaders'

export const LazyLauncherWorkspace = lazy(loadLauncherWorkspace)

export const LazyMarketDataWorkspace = lazy(loadMarketDataWorkspace)

export const LazyStorageWorkspace = lazy(loadStorageWorkspace)

export const LazySystemWorkspace = lazy(loadSystemWorkspace)

export const LazyBacktestsWorkspace = lazy(loadBacktestsWorkspace)

export const LazyDiscoverWorkspace = lazy(loadDiscoverWorkspace)

export const LazyResearchWorkspace = lazy(loadResearchWorkspace)

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

export const LazyValidateWorkflow = lazy(() =>
  import('@/workspaces/backtests/ValidateWorkflow').then((module) => ({
    default: module.ValidateWorkflow,
  })),
)

export const LazyStandaloneChartWindow = lazy(() =>
  import('@/components/backtests/StandaloneChartWindow').then((module) => ({
    default: module.StandaloneChartWindow,
  })),
)

export const LazyStrategyBuilderWorkspace = lazy(loadStrategyBuilderWorkspace)
