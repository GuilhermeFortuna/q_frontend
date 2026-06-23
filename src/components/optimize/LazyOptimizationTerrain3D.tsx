import { lazy, Suspense } from 'react'

import { FeatureIslandFallback } from '@/components/islands/FeatureIslandFallback'
import type { OptimizationResults } from '@/types/optimization'

const OptimizationTerrain3D = lazy(() =>
  import('@/components/optimize/OptimizationTerrain3D').then((module) => ({
    default: module.OptimizationTerrain3D,
  })),
)

type LazyOptimizationTerrain3DProps = {
  results: OptimizationResults
  selectedTrialNumber: number | null
  onSelectTrial: (trialNumber: number | null) => void
}

export function LazyOptimizationTerrain3D(props: LazyOptimizationTerrain3DProps) {
  return (
    <Suspense fallback={<FeatureIslandFallback variant="pane" label="Loading 3D landscape" />}>
      <OptimizationTerrain3D {...props} />
    </Suspense>
  )
}
