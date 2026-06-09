import { inputClass } from '@/components/shared/InstrumentConfigFields'
import { useStrategies } from '@/api/queries/strategies'
import type { BacktestHistorySort } from '@/types/backtesting'
import { cn } from '@/lib/utils'

export type BacktestHistoryTab = 'all' | 'saved'

type BacktestHistoryFiltersProps = {
  tab: BacktestHistoryTab
  onTabChange: (tab: BacktestHistoryTab) => void
  symbol: string
  onSymbolChange: (symbol: string) => void
  strategy: string
  onStrategyChange: (strategy: string) => void
  sort: BacktestHistorySort
  onSortChange: (sort: BacktestHistorySort) => void
}

const tabClass = (active: boolean) =>
  cn(
    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
    active
      ? 'bg-brass-500/15 text-brass-300'
      : 'text-silver-400 hover:bg-carbon-800/60 hover:text-silver-200',
  )

export function BacktestHistoryFilters({
  tab,
  onTabChange,
  symbol,
  onSymbolChange,
  strategy,
  onStrategyChange,
  sort,
  onSortChange,
}: BacktestHistoryFiltersProps) {
  const strategiesQuery = useStrategies()
  const strategies = strategiesQuery.data?.strategies ?? []

  return (
    <div className="border-carbon-600/60 shrink-0 space-y-3 border-b px-3 py-3">
      <div className="flex gap-1">
        <button
          type="button"
          className={tabClass(tab === 'all')}
          onClick={() => onTabChange('all')}
        >
          All runs
        </button>
        <button
          type="button"
          className={tabClass(tab === 'saved')}
          onClick={() => onTabChange('saved')}
        >
          Saved
        </button>
      </div>

      <input
        type="text"
        value={symbol}
        onChange={(e) => onSymbolChange(e.target.value)}
        placeholder="Filter symbol…"
        className={cn(inputClass, 'h-8 text-xs')}
        aria-label="Filter by symbol"
      />

      <select
        value={strategy}
        onChange={(e) => onStrategyChange(e.target.value)}
        className={cn(inputClass, 'h-8 text-xs')}
        aria-label="Filter by strategy"
      >
        <option value="">All strategies</option>
        {strategies.map((item) => (
          <option key={item.name} value={item.name}>
            {item.label}
          </option>
        ))}
      </select>

      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as BacktestHistorySort)}
        className={cn(inputClass, 'h-8 text-xs')}
        aria-label="Sort runs"
      >
        <option value="created_at_desc">Newest first</option>
        <option value="pnl_desc">Best PnL first</option>
        <option value="pnl_asc">Worst PnL first</option>
      </select>
    </div>
  )
}
