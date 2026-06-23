/**
 * Rollup manual chunk groups for startup vs deferred vendor splits (WO106).
 */
export function resolveManualChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) {
    return undefined
  }

  if (id.includes('/@react-three/drei/')) {
    return 'vendor-drei'
  }

  if (id.includes('/@react-three/fiber/') || id.includes('/three/')) {
    return 'vendor-three'
  }

  if (
    id.includes('/recharts/') ||
    id.includes('/@visx/') ||
    id.includes('/node_modules/d3/') ||
    id.includes('/d3-')
  ) {
    return 'vendor-charts'
  }

  if (id.includes('/motion/')) {
    return 'vendor-motion'
  }

  if (id.includes('@tanstack/react-router')) {
    return 'vendor-router'
  }

  if (id.includes('@tanstack/react-query')) {
    return 'vendor-query'
  }

  if (id.includes('/react-dom/') || id.includes('/node_modules/react/')) {
    return 'vendor-react'
  }

  return undefined
}
