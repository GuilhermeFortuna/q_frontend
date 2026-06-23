import { Suspense, type ReactNode } from 'react'

import { FeatureIslandFallback } from '@/components/islands/FeatureIslandFallback'

type LazyRouteBoundaryProps = {
  children: ReactNode
  label?: string
}

export function LazyRouteBoundary({ children, label }: LazyRouteBoundaryProps) {
  return <Suspense fallback={<FeatureIslandFallback label={label} />}>{children}</Suspense>
}
