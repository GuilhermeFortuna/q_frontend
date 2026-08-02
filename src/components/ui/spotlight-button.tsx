import type { ComponentPropsWithoutRef, ComponentType, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type SpotlightNavItemSize = 'default' | 'large'

const ITEM_METRICS = {
  default: {
    hit: 'mx-1.5 flex-col gap-1 px-3 py-2',
    icon: 'size-6',
    label: 'text-2xs',
    stride: 64,
    indicatorWidth: 48,
    indicatorInset: 16,
  },
  large: {
    hit: 'mx-2 flex-col gap-1.5 px-4 py-3',
    icon: 'size-9',
    label: 'text-xs',
    stride: 84,
    indicatorWidth: 64,
    indicatorInset: 18,
  },
} as const

export function getSpotlightIndicatorStyle(
  activeIndex: number,
  size: SpotlightNavItemSize = 'default',
): { left: string; width: string; transform: string } {
  const metrics = ITEM_METRICS[size]
  return {
    left: `${activeIndex * metrics.stride + metrics.indicatorInset}px`,
    width: `${metrics.indicatorWidth}px`,
    transform: 'translateY(-1px)',
  }
}

type SpotlightNavItemProps = {
  icon: ComponentType<{ className?: string }>
  label?: string
  isActive?: boolean
  indicatorPosition: number
  position: number
  size?: SpotlightNavItemSize
  className?: string
  children?: ReactNode
} & Omit<ComponentPropsWithoutRef<'span'>, 'children'>

export function SpotlightNavItem({
  icon: Icon,
  label,
  isActive = false,
  indicatorPosition: _indicatorPosition,
  position: _position,
  size = 'default',
  className,
  children,
  ...props
}: SpotlightNavItemProps) {
  const metrics = ITEM_METRICS[size]

  return (
    <span
      className={cn(
        'relative flex items-center justify-center overflow-hidden transition-all duration-400',
        metrics.hit,
        className,
      )}
      {...props}
    >
      {isActive ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-400"
          style={{
            background:
              'radial-gradient(ellipse 75% 95% at 50% -5%, rgba(240, 180, 41, 0.5) 0%, rgba(240, 180, 41, 0.22) 28%, rgba(240, 180, 41, 0.06) 55%, transparent 72%)',
          }}
        />
      ) : null}
      <span className="relative z-10 flex">
        <Icon
          className={cn(
            'transition-all duration-200',
            metrics.icon,
            isActive
              ? 'scale-110 brightness-110 text-brass-400'
              : 'scale-95 opacity-50 group-hover:scale-105 group-hover:opacity-100',
          )}
        />
        {children}
      </span>
      {label ? (
        <span
          className={cn(
            'relative z-10 whitespace-nowrap font-mono font-[560] tracking-[0.08em] uppercase transition-colors duration-200',
            metrics.label,
            isActive ? 'text-brass-400' : 'text-silver-400 group-hover:text-silver-200',
          )}
        >
          {label}
        </span>
      ) : null}
    </span>
  )
}

type SpotlightTopIndicatorProps = {
  activeIndex: number
  size?: SpotlightNavItemSize
  className?: string
}

export function SpotlightTopIndicator({
  activeIndex,
  size = 'default',
  className,
}: SpotlightTopIndicatorProps) {
  if (activeIndex < 0) return null

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute top-0 h-0.5 bg-brass-400 shadow-[0_6px_12px_rgba(240,180,41,0.55)] transition-all duration-400 ease-in-out',
        className,
      )}
      style={getSpotlightIndicatorStyle(activeIndex, size)}
    />
  )
}
