import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'

export type GlowCardProps = {
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
  width?: string | number
  height?: string | number
  /** When true, ignores size prop and uses width/height or className for sizing. */
  customSize?: boolean
}

const sizeMap = {
  sm: 'w-48 h-64',
  md: 'w-64 h-80',
  lg: 'w-80 h-96',
} as const

/**
 * Brass/gold pointer-reactive glow shell.
 * Spotlight CSS lives in materials.css under `[data-glow]`.
 */
export function GlowCard({
  children,
  className,
  size = 'md',
  width,
  height,
  customSize = false,
}: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (reducedMotion) return

    const syncPointer = (event: PointerEvent) => {
      const node = cardRef.current
      if (!node) return
      // Local coords with px units. Viewport + background-attachment:fixed breaks under
      // motion.div transforms (mirrored glow across panels).
      const rect = node.getBoundingClientRect()
      const localX = event.clientX - rect.left
      const localY = event.clientY - rect.top
      const width = rect.width || 1
      const height = rect.height || 1
      node.style.setProperty('--x', `${localX.toFixed(2)}px`)
      node.style.setProperty('--y', `${localY.toFixed(2)}px`)
      node.style.setProperty('--xp', (localX / width).toFixed(2))
      node.style.setProperty('--yp', (localY / height).toFixed(2))
    }

    document.addEventListener('pointermove', syncPointer, { passive: true })
    return () => document.removeEventListener('pointermove', syncPointer)
  }, [reducedMotion])

  const style: CSSProperties = {
    ...(width !== undefined
      ? { width: typeof width === 'number' ? `${width}px` : width }
      : null),
    ...(height !== undefined
      ? { height: typeof height === 'number' ? `${height}px` : height }
      : null),
  }

  return (
    <div
      ref={cardRef}
      data-glow
      style={style}
      className={cn(
        customSize
          ? 'flex min-h-0 flex-col'
          : cn(sizeMap[size], 'aspect-[3/4] grid grid-rows-[1fr_auto] gap-4 p-4'),
        className,
      )}
    >
      <div data-glow aria-hidden="true" />
      <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
