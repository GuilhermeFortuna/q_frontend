import { cn } from '@/lib/utils'

export type StatTileDeltaTone = 'up' | 'down' | 'neutral' | 'warning'

export type StatTileProps = {
  label: string
  value: string
  delta?: string
  deltaTone?: StatTileDeltaTone
  valueTone?: StatTileDeltaTone
  highlight?: boolean
  className?: string
}

const deltaToneClass: Record<StatTileDeltaTone, string> = {
  up: 'text-emerald-400',
  down: 'text-rose-400',
  neutral: 'text-silver-400',
  warning: 'text-amber-400',
}

export function StatTile({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  valueTone = 'neutral',
  highlight = false,
  className,
}: StatTileProps) {
  return (
    <div className={cn('surface-card surface-card--edge rounded-xl p-4', className)}>
      <p className="accent-wayfinding text-[11px] font-[560] tracking-[0.08em] uppercase">
        {label}
      </p>
      <p
        className={cn(
          'font-display stat-tile-value tracking-display mt-1.5 text-xl font-bold',
          highlight
            ? 'text-gold-400'
            : valueTone === 'up'
              ? 'text-emerald-400'
              : valueTone === 'down'
                ? 'text-rose-400'
                : valueTone === 'warning'
                  ? 'text-amber-400'
                  : 'text-silver-100',
        )}
      >
        {value}
      </p>
      {delta ? (
        <p className={cn('mt-1 text-xs font-medium', deltaToneClass[deltaTone])}>{delta}</p>
      ) : null}
    </div>
  )
}
