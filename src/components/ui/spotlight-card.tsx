import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type GlowIntensity = 'panel' | 'card' | 'tile'

export type GlowCardProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children: ReactNode
  className?: string
  /** Glow strength / density. Defaults to `panel`. */
  intensity?: GlowIntensity
  size?: 'sm' | 'md' | 'lg'
  width?: string | number
  height?: string | number
  /**
   * When true (default), ignores size presets and sizes via width/height or className.
   * Set false only for fixed gallery/demo cards.
   */
  customSize?: boolean
  /**
   * When true, content may paint outside the card (e.g. soft bloom). Defaults to clipped.
   */
  overflowVisible?: boolean
}

const sizeMap = {
  sm: 'w-48 h-64',
  md: 'w-64 h-80',
  lg: 'w-80 h-96',
} as const

/**
 * Brass/gold pointer-reactive glow shell.
 * Spotlight CSS lives in materials.css under `[data-glow]`.
 * Pointer vars are written by the app-root PointerSpotlight (no per-instance listeners).
 */
export function GlowCard({
  children,
  className,
  intensity = 'panel',
  size = 'md',
  width,
  height,
  customSize = true,
  overflowVisible = false,
  style: styleProp,
  ...rest
}: GlowCardProps) {
  const style: CSSProperties = {
    ...styleProp,
    ...(width !== undefined
      ? { width: typeof width === 'number' ? `${width}px` : width }
      : null),
    ...(height !== undefined
      ? { height: typeof height === 'number' ? `${height}px` : height }
      : null),
  }

  return (
    <div
      data-glow={intensity}
      style={style}
      className={cn(
        customSize
          ? 'flex min-h-0 flex-col'
          : cn(sizeMap[size], 'aspect-[3/4] grid grid-rows-[1fr_auto] gap-4 p-4'),
        className,
      )}
      {...rest}
    >
      <div data-glow-bloom aria-hidden="true" />
      <div
        className={cn(
          'relative z-10 flex h-full min-h-0 min-w-0 flex-1 flex-col',
          overflowVisible ? 'overflow-visible' : 'overflow-hidden',
        )}
      >
        {children}
      </div>
    </div>
  )
}
