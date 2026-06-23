import { lazy, Suspense } from 'react'

import { FeatureIslandFallback } from '@/components/islands/FeatureIslandFallback'
import type { StrategySearchResults, StrategySearchStatus } from '@/types/strategySearch'

const LiveSwarmVisualizer3D = lazy(() =>
  import('@/components/discover/LiveSwarmVisualizer3D').then((module) => ({
    default: module.LiveSwarmVisualizer3D,
  })),
)

export type LazyLiveSwarmVisualizer3DProps = {
  status: StrategySearchStatus | undefined
  results: StrategySearchResults | undefined
  isRunning: boolean
  selectedTrialId?: string | null
  onSelectTrialId?: (trialId: string | null) => void
}

export function LazyLiveSwarmVisualizer3D(props: LazyLiveSwarmVisualizer3DProps) {
  return (
    <Suspense fallback={<FeatureIslandFallback variant="pane" label="Loading swarm visualizer" />}>
      <LiveSwarmVisualizer3D {...props} />
    </Suspense>
  )
}
