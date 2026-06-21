import { Cpu, Trash2 } from 'lucide-react'
import { memo, useMemo, useState } from 'react'

import {
  categoryLabel,
  CUSTOM_STRATEGY_CATEGORY_LABEL,
  isCustomStrategy,
  STRATEGY_CATEGORY_ORDER,
  strategyCardDescription,
  strategyCategory,
  strategyEngine,
} from '@/lib/strategies/strategyPresentation'
import { cn } from '@/lib/utils'
import type { CustomStrategy, StrategyCategory, StrategyInfo } from '@/types/strategies'

type StrategyLibraryProps = {
  strategies: StrategyInfo[]
  strategyCatalog?: StrategyInfo[]
  customStrategies?: CustomStrategy[]
  engine: 'candle' | 'tick'
  selectedStrategyName: string | undefined
  selectedCustomName?: string | null
  onSelectBuiltIn: (name: string) => void
  onSelectCustom?: (custom: CustomStrategy) => void
  onDeleteCustom?: (name: string) => void
  loading?: boolean
}

type CategoryFilter = StrategyCategory | 'all' | 'saved'

export const StrategyLibrary = memo(function StrategyLibrary({
  strategies,
  strategyCatalog,
  customStrategies = [],
  engine,
  selectedStrategyName,
  selectedCustomName = null,
  onSelectBuiltIn,
  onSelectCustom,
  onDeleteCustom,
  loading = false,
}: StrategyLibraryProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')

  const engineFiltered = useMemo(
    () => strategies.filter((entry) => strategyEngine(entry) === engine),
    [strategies, engine],
  )

  const catalog = strategyCatalog ?? strategies

  const savedForEngine = useMemo(() => {
    return customStrategies.filter((custom) => {
      const base = catalog.find((entry) => entry.name === custom.base_strategy)
      return base ? strategyEngine(base) === engine : true
    })
  }, [customStrategies, engine, catalog])

  const hasSaved = savedForEngine.length > 0

  const availableCategories = useMemo(() => {
    const present = new Set(engineFiltered.map((entry) => strategyCategory(entry)))
    return STRATEGY_CATEGORY_ORDER.filter((category) => present.has(category))
  }, [engineFiltered])

  const customNames = useMemo(
    () => new Set(customStrategies.map((entry) => entry.name)),
    [customStrategies],
  )

  const visibleStrategies = useMemo(() => {
    if (categoryFilter === 'saved') return []
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
        {hasSaved ? (
          <CategoryChip
            label={CUSTOM_STRATEGY_CATEGORY_LABEL}
            active={categoryFilter === 'saved'}
            onClick={() => setCategoryFilter('saved')}
          />
        ) : null}
      </div>

      {categoryFilter === 'saved' ? (
        savedForEngine.length === 0 ? (
          <p className="text-silver-400 text-sm">No saved strategies yet.</p>
        ) : (
          <div className="grid min-h-0 flex-1 auto-rows-min gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
            {savedForEngine.map((custom) => (
              <CustomStrategyCard
                key={custom.name}
                custom={custom}
                baseLabel={
                  catalog.find((entry) => entry.name === custom.base_strategy)?.label ??
                  custom.base_strategy
                }
                selected={
                  selectedCustomName === custom.name || selectedStrategyName === custom.name
                }
                onSelect={() => {
                  if (onSelectCustom) {
                    onSelectCustom(custom)
                    return
                  }
                  onSelectBuiltIn(custom.name)
                }}
                onDelete={onDeleteCustom ? () => onDeleteCustom(custom.name) : undefined}
              />
            ))}
          </div>
        )
      ) : visibleStrategies.length === 0 ? (
        <p className="text-silver-400 text-sm">No strategies match this filter.</p>
      ) : (
        <div className="grid min-h-0 flex-1 auto-rows-min gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
          {visibleStrategies.map((entry) => (
            <StrategyCard
              key={entry.name}
              strategy={entry}
              selected={!selectedCustomName && entry.name === selectedStrategyName}
              isCustom={isCustomStrategy(entry.name, customNames)}
              onSelect={() => onSelectBuiltIn(entry.name)}
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
  isCustom,
  onSelect,
}: {
  strategy: StrategyInfo
  selected: boolean
  isCustom: boolean
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
        {isCustom ? (
          <span className="bg-carbon-800/80 text-brass-300 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
            Custom
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

function CustomStrategyCard({
  custom,
  baseLabel,
  selected,
  onSelect,
  onDelete,
}: {
  custom: CustomStrategy
  baseLabel: string
  selected: boolean
  onSelect: () => void
  onDelete?: () => void
}) {
  return (
    <div
      className={cn(
        'group border-carbon-600/50 bg-carbon-950/40 hover:border-brass-500/30 relative flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors',
        selected && 'border-brass-500/60 bg-brass-600/10 ring-brass-500/20 ring-1',
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        data-testid={`custom-strategy-card-${custom.name}`}
        onClick={onSelect}
        className="flex flex-col gap-2 text-left"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <Cpu className="text-brass-400 h-4 w-4 shrink-0" aria-hidden />
          <span className="text-silver-100 text-sm font-semibold">{custom.name}</span>
          <span className="bg-brass-600/15 text-brass-400 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
            Custom
          </span>
        </div>
        <p className="text-silver-500 font-mono text-[10px]">{baseLabel}</p>
        {custom.description ? (
          <p className="text-silver-400 line-clamp-2 text-xs leading-relaxed">
            {custom.description}
          </p>
        ) : null}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onDelete?.()
        }}
        disabled={!onDelete}
        className={cn(
          'text-silver-500 hover:bg-carbon-800/50 absolute top-2 right-2 rounded p-0.5 transition-opacity group-hover:text-rose-400',
          onDelete ? 'opacity-0 group-hover:opacity-100' : 'hidden',
        )}
        title={onDelete ? `Delete custom strategy ${custom.name}` : undefined}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">Delete {custom.name}</span>
      </button>
    </div>
  )
}
