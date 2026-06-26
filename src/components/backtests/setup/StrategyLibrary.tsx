import { Cpu, Plus, Trash2 } from 'lucide-react'
import { memo, useMemo, useState } from 'react'

import { LibraryCard } from '@/components/backtests/setup/LibraryCard'
import { EntityCard } from '@/components/ui/EntityCard'
import { FilterPills } from '@/components/ui/FilterPills'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
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
  selectedStrategyName?: string | undefined
  selectedCustomName?: string | null
  onSelectBuiltIn?: (name: string) => void
  onSelectCustom?: (custom: CustomStrategy) => void
  onDeleteCustom?: (name: string) => void
  loading?: boolean
  loadingSaved?: boolean
  multiSelect?: boolean
  instanceCounts?: Record<string, number>
  onAddEntry?: (name: string) => void
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
  loadingSaved = false,
  multiSelect = false,
  instanceCounts = {},
  onAddEntry,
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

  const filterOptions = useMemo(() => {
    const options: { value: CategoryFilter; label: string }[] = [{ value: 'all', label: 'All' }]
    for (const category of availableCategories) {
      options.push({ value: category, label: categoryLabel(category) })
    }
    if (hasSaved || loadingSaved) {
      options.push({ value: 'saved', label: CUSTOM_STRATEGY_CATEGORY_LABEL })
    }
    return options
  }, [availableCategories, hasSaved, loadingSaved])

  if (loading) {
    return (
      <div className="text-silver-400 flex flex-1 items-center justify-center text-sm">
        Loading strategies…
      </div>
    )
  }

  return (
    <Panel living className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <SectionHeader title="Entry Strategies" />
      <FilterPills
        options={filterOptions}
        value={categoryFilter}
        onChange={setCategoryFilter}
        aria-label="Entry strategy categories"
      />

      {categoryFilter === 'saved' ? (
        loadingSaved ? (
          <div className="text-silver-400 flex flex-1 items-center justify-center text-sm">
            Loading saved strategies…
          </div>
        ) : savedForEngine.length === 0 ? (
          <p className="text-silver-400 text-sm">No saved strategies yet.</p>
        ) : (
          <div className="grid min-h-0 flex-1 auto-rows-min gap-2 overflow-y-auto p-1.5 pb-4 sm:grid-cols-2 xl:grid-cols-3">
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
                  onAddEntry?.(custom.name)
                  onSelectBuiltIn?.(custom.name)
                }}
                onDelete={onDeleteCustom ? () => onDeleteCustom(custom.name) : undefined}
              />
            ))}
          </div>
        )
      ) : visibleStrategies.length === 0 ? (
        <p className="text-silver-400 text-sm">No strategies match this filter.</p>
      ) : (
        <div className="grid min-h-0 flex-1 auto-rows-min gap-2 overflow-y-auto p-1.5 pb-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleStrategies.map((entry) => (
            <StrategyCard
              key={entry.name}
              strategy={entry}
              selected={
                multiSelect
                  ? (instanceCounts[entry.name] ?? 0) > 0
                  : !selectedCustomName && entry.name === selectedStrategyName
              }
              instanceCount={instanceCounts[entry.name] ?? 0}
              isCustom={isCustomStrategy(entry.name, customNames)}
              onSelect={() => {
                if (multiSelect) {
                  onAddEntry?.(entry.name)
                  return
                }
                onSelectBuiltIn?.(entry.name)
              }}
              onAddAnother={
                multiSelect && (instanceCounts[entry.name] ?? 0) > 0
                  ? () => onAddEntry?.(entry.name)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </Panel>
  )
})

function StrategyCard({
  strategy,
  selected,
  instanceCount = 0,
  isCustom,
  onSelect,
  onAddAnother,
}: {
  strategy: StrategyInfo
  selected: boolean
  instanceCount?: number
  isCustom: boolean
  onSelect: () => void
  onAddAnother?: () => void
}) {
  const category = strategyCategory(strategy)
  const isTick = strategyEngine(strategy) === 'tick'

  return (
    <div className="flex flex-col gap-1">
      <LibraryCard
        title={strategy.label}
        tag={categoryLabel(category)}
        description={strategyCardDescription(strategy)}
        paramCount={strategy.params.length}
        selected={selected}
        onClick={onSelect}
        badges={
          <>
            {instanceCount > 1 ? (
              <span className="bg-brass-600/20 text-brass-300 rounded px-1.5 py-0.5 text-[10px] font-bold">
                ×{instanceCount}
              </span>
            ) : null}
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
          </>
        }
      />
      {onAddAnother ? (
        <button
          type="button"
          onClick={onAddAnother}
          className="text-brass-400 hover:text-brass-300 inline-flex items-center gap-1 self-start px-1 text-[10px] font-semibold tracking-wide uppercase"
        >
          <Plus className="h-3 w-3" aria-hidden />
          Add another {strategy.label}
        </button>
      ) : null}
    </div>
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
      className="group relative flex flex-col gap-1"
      data-testid={`custom-strategy-card-${custom.name}`}
    >
      <EntityCard
        title={custom.name}
        tag="Custom"
        description={custom.description ?? `Based on ${baseLabel}`}
        selected={selected}
        onSelect={onSelect}
        badges={<Cpu className="text-brass-400 h-4 w-4 shrink-0" aria-hidden />}
      />
      <p className="text-silver-500 px-1 font-mono text-[10px]">{baseLabel}</p>
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
