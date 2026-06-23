import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef, type RefObject } from 'react'

import { VIRTUALIZE_THRESHOLD } from '@/lib/virtualization/constants'

type UseVirtualListOptions = {
  count: number
  estimateSize?: number | ((index: number) => number)
  overscan?: number
  threshold?: number
  getItemKey?: (index: number) => string | number
  /** When this value changes, cached row measurements are recomputed. */
  remeasureKey?: unknown
}

export type VirtualListResult = {
  scrollRef: RefObject<HTMLDivElement | null>
  virtualizer: Virtualizer<HTMLDivElement, Element>
  shouldVirtualize: boolean
}

export function useVirtualList({
  count,
  estimateSize = 48,
  overscan = 8,
  threshold = VIRTUALIZE_THRESHOLD,
  getItemKey,
  remeasureKey,
}: UseVirtualListOptions): VirtualListResult {
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldVirtualize = count >= threshold

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: typeof estimateSize === 'function' ? estimateSize : () => estimateSize,
    overscan,
    enabled: shouldVirtualize,
    getItemKey,
  })

  useEffect(() => {
    if (!shouldVirtualize) return
    virtualizer.measure()
  }, [remeasureKey, shouldVirtualize, virtualizer])

  return { scrollRef, virtualizer, shouldVirtualize }
}
