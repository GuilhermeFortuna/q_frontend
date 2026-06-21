import { memo, useMemo, useState } from 'react'

import {
  categoryLabel,
  STRATEGY_CATEGORY_ORDER,
  strategyCardDescription,
  strategyCategory,
  strategyEngine,
} from '@/lib/strategies/strategyPresentation'
import { cn } from '@/lib/utils'
import type { StrategyCategory, StrategyInfo } from '@/types/strategies'

type StrategyLibraryProps = {
  strategies: StrategyInfo[]
  engine: 'candle' | 'tick'
  selectedStrategyName: string | undefined
  onSelectStrategy: (name: string) => void
  loading?: boolean
}

type CategoryFilter = StrategyCategory | 'all'

export const StrategyLibrary = memo(function StrategyLibrary({
  strategies,
  engine,
  selectedStrategyName,
  onSelectStrategy,
  loading = false,
}: StrategyLibraryProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')

  const engineFiltered = useMemo(
    () => strategies.filter((entry) => strategyEngine(entry) === engine),
    [strategies, engine],
  )

  const availableCategories = useMemo(() => {
    const present = new Set(engineFiltered.map((entry) => strategyCategory(entry)))
    return STRATEGY_CATEGORY_ORDER.filter((category) => present.has(category))
  }, [engineFiltered])

  const visibleStrategies = useMemo(() => {
    if (categoryFilter === 'all') return engineFiltered
    return engineFiltered.filter((entry) => strategyCategory(entry) === categoryFilter)
  }, [engineFiltered, categoryFilter])

  if (loading) {
    return (
      <div className="text-silver-400 flex flex-1 items-center justify-center text-sm">
        Loading strategies…
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        <CategoryChip
          label="All"
          active={categoryFilter === 'all'}
          onClick={() => setCategoryFilter('all')}
        />
        {availableCategories.map((category) => (
          <CategoryChip
            key={category}
            label={categoryLabel(category)}
            active={categoryFilter === category}
            onClick={() => setCategoryFilter(category)}
          />
        ))}
      </div>

      {visibleStrategies.length === 0 ? (
        <p className="text-silver-400 text-sm">No strategies match this filter.</p>
      ) : (
        <div className="grid min-h-0 flex-1 auto-rows-min gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
          {visibleStrategies.map((entry) => (
            <StrategyCard
              key={entry.name}
              strategy={entry}
              selected={entry.name === selectedStrategyName}
              onSelect={() => onSelectStrategy(entry.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
})

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors',
        active
          ? 'border-brass-500/50 bg-brass-600/15 text-brass-400'
          : 'border-carbon-600/40 bg-carbon-900/40 text-silver-300 hover:border-brass-500/30 hover:text-brass-400',
      )}
    >
      {label}
    </button>
  )
}

function StrategyCard({
  strategy,
  selected,
  onSelect,
}: {
  strategy: StrategyInfo
  selected: boolean
  onSelect: () => void
}) {
  const category = strategyCategory(strategy)
  const isTick = strategyEngine(strategy) === 'tick'

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'border-carbon-600/50 bg-carbon-950/40 hover:border-brass-500/30 flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors',
        selected && 'border-brass-500/60 bg-brass-600/10 ring-brass-500/20 ring-1',
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-silver-100 text-sm font-semibold">{strategy.label}</span>
        <span className="bg-carbon-800/80 text-brass-400/90 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
          {categoryLabel(category)}
        </span>
        {isTick ? (
          <span className="bg-carbon-800/80 text-silver-400 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
            Tick
          </span>
        ) : null}
      </div>
      <p className="text-silver-400 line-clamp-2 text-xs leading-relaxed">
        {strategyCardDescription(strategy)}
      </p>
      <p className="text-silver-500 text-[10px]">
        {strategy.params.length} param{strategy.params.length === 1 ? '' : 's'}
      </p>
    </button>
  )
}
