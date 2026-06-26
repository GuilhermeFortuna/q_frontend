import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useFeatureList, type FeatureListParams } from '@/api/queries/features'
import {
  categoryLabel,
  FEATURE_STORE_DEFAULT_SORT,
  formatFeatureScore,
  sortFeatureList,
  statusChipClass,
  type FeatureStoreSortColumn,
  type FeatureStoreSortDirection,
} from '@/components/research/featureStoreUtils'
import { Button } from '@/components/ui/button'
import { FilterPills } from '@/components/ui/FilterPills'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatTile } from '@/components/ui/StatTile'
import { cn } from '@/lib/utils'
import type { FeatureListItem, FeatureStatus } from '@/types/features'

const STATUS_FILTER_OPTIONS: { value: FeatureStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'experimental', label: 'Experimental' },
  { value: 'candidate', label: 'Candidate' },
  { value: 'production', label: 'Production' },
]

const TABLE_COLUMNS: {
  key: FeatureStoreSortColumn
  label: string
  align?: 'left' | 'right'
}[] = [
  { key: 'feature', label: 'Feature' },
  { key: 'type', label: 'Type' },
  { key: 'version', label: 'Version', align: 'right' },
  { key: 'status', label: 'Status' },
  { key: 'usage', label: 'Usage', align: 'right' },
  { key: 'score', label: 'Score', align: 'right' },
]

type FeatureStoreTableProps = {
  features: FeatureListItem[]
  onSelectFeature: (name: string) => void
  sortColumn?: FeatureStoreSortColumn
  sortDirection?: FeatureStoreSortDirection
  onSortChange?: (column: FeatureStoreSortColumn, direction: FeatureStoreSortDirection) => void
  loading?: boolean
}

function SortIndicator({
  column,
  activeColumn,
  direction,
}: {
  column: FeatureStoreSortColumn
  activeColumn: FeatureStoreSortColumn
  direction: FeatureStoreSortDirection
}) {
  if (column !== activeColumn) {
    return <ArrowUpDown className="text-silver-500 h-3 w-3" aria-hidden />
  }
  return direction === 'asc' ? (
    <ArrowUp className="text-gold-400 h-3 w-3" aria-hidden />
  ) : (
    <ArrowDown className="text-gold-400 h-3 w-3" aria-hidden />
  )
}

function FeatureStoreSkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => (
        <tr key={index} className="border-carbon-800/60 border-t">
          {TABLE_COLUMNS.map((column) => (
            <td key={column.key} className="px-3 py-3">
              <div className="bg-carbon-800/40 h-4 animate-pulse rounded" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function LeakageWarning({ leakageStatus }: { leakageStatus?: string | null }) {
  if (!leakageStatus || leakageStatus === 'clean') {
    return null
  }

  return (
    <span
      className="text-brass-400 inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase"
      title={`Leakage status: ${leakageStatus}`}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden />
      <span className="sr-only">Leakage warning</span>
    </span>
  )
}

export function FeatureStoreTable({
  features,
  onSelectFeature,
  sortColumn: controlledSortColumn,
  sortDirection: controlledSortDirection,
  onSortChange,
  loading = false,
}: FeatureStoreTableProps) {
  const [localSortColumn, setLocalSortColumn] = useState<FeatureStoreSortColumn>(
    FEATURE_STORE_DEFAULT_SORT.column,
  )
  const [localSortDirection, setLocalSortDirection] = useState<FeatureStoreSortDirection>(
    FEATURE_STORE_DEFAULT_SORT.direction,
  )

  const sortColumn = controlledSortColumn ?? localSortColumn
  const sortDirection = controlledSortDirection ?? localSortDirection

  const sortedFeatures = useMemo(
    () => sortFeatureList(features, sortColumn, sortDirection),
    [features, sortColumn, sortDirection],
  )

  const handleSort = (column: FeatureStoreSortColumn) => {
    const nextDirection: FeatureStoreSortDirection =
      sortColumn === column && sortDirection === 'desc' ? 'asc' : 'desc'

    if (onSortChange) {
      onSortChange(column, nextDirection)
      return
    }

    setLocalSortColumn(column)
    setLocalSortDirection(nextDirection)
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto" data-testid="feature-store-table">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="bg-silver-950/40 sticky top-0 z-10 backdrop-blur-sm">
          <tr>
            {TABLE_COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'text-silver-400 px-3 py-2 text-left text-[10px] font-bold tracking-wider uppercase',
                  column.align === 'right' && 'text-right',
                )}
              >
                <button
                  type="button"
                  className={cn(
                    'hover:text-silver-100 inline-flex items-center gap-1.5 transition-colors',
                    column.align === 'right' && 'ml-auto',
                  )}
                  onClick={() => handleSort(column.key)}
                  aria-label={`Sort by ${column.label}`}
                >
                  {column.label}
                  <SortIndicator
                    column={column.key}
                    activeColumn={sortColumn}
                    direction={sortDirection}
                  />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? <FeatureStoreSkeletonRows /> : null}
          {!loading
            ? sortedFeatures.map((feature) => (
                <tr
                  key={feature.name}
                  className="border-carbon-800/60 hover:bg-carbon-800/35 text-silver-200 cursor-pointer border-t transition-all duration-150"
                  onClick={() => onSelectFeature(feature.name)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectFeature(feature.name)
                    }
                  }}
                  tabIndex={0}
                  data-testid={`feature-store-row-${feature.name}`}
                >
                  <td className="text-cream-100 px-3 py-2.5 font-mono font-medium">
                    <span className="inline-flex items-center gap-2">
                      {feature.name}
                      <LeakageWarning leakageStatus={feature.leakage_status} />
                    </span>
                  </td>
                  <td className="text-silver-300 px-3 py-2.5 capitalize">
                    {categoryLabel(feature.category)}
                  </td>
                  <td className="text-silver-300 px-3 py-2.5 text-right font-mono">
                    v{feature.latest_version}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={statusChipClass(feature.status)}>{feature.status}</span>
                  </td>
                  <td className="text-silver-300 px-3 py-2.5 text-right font-mono">
                    {feature.usage_count}
                  </td>
                  <td className="text-silver-100 px-3 py-2.5 text-right font-mono">
                    {formatFeatureScore(feature.score)}
                  </td>
                </tr>
              ))
            : null}
        </tbody>
      </table>
    </div>
  )
}

type FeatureStorePanelProps = {
  onSelectFeature?: (name: string) => void
}

export function FeatureStorePanel({ onSelectFeature }: FeatureStorePanelProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<FeatureStatus | 'all'>('all')

  const listParams = useMemo<FeatureListParams>(() => {
    const params: FeatureListParams = {}
    if (categoryFilter !== 'all') {
      params.category = categoryFilter
    }
    if (statusFilter !== 'all') {
      params.status = statusFilter
    }
    return params
  }, [categoryFilter, statusFilter])

  const catalogQuery = useFeatureList(listParams)
  const allFeaturesQuery = useFeatureList()

  const features = catalogQuery.data?.features ?? []
  const categoryOptions = useMemo(() => {
    const categories = new Set(
      (allFeaturesQuery.data?.features ?? []).map((feature) => feature.category),
    )
    return [
      { value: 'all', label: 'All categories' },
      ...[...categories]
        .sort((left, right) => left.localeCompare(right))
        .map((category) => ({
          value: category,
          label: categoryLabel(category),
        })),
    ]
  }, [allFeaturesQuery.data?.features])

  const productionCount = features.filter((feature) => feature.status === 'production').length
  const scoredCount = features.filter((feature) => feature.score !== null).length
  const hasActiveFilters = categoryFilter !== 'all' || statusFilter !== 'all'

  const clearFilters = () => {
    setCategoryFilter('all')
    setStatusFilter('all')
  }

  if (catalogQuery.isError) {
    return (
      <Panel className="flex h-full flex-col p-4" data-testid="research-tab-store">
        <SectionHeader title="Feature Store" />
        <div className="flex flex-1 items-center justify-center text-sm text-rose-400">
          Failed to load feature catalog.
        </div>
      </Panel>
    )
  }

  return (
    <Panel className="flex h-full min-h-0 flex-col gap-4 p-4" data-testid="research-tab-store">
      <SectionHeader title="Feature Store" />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Total features" value={String(features.length)} />
        <StatTile label="Production" value={String(productionCount)} />
        <StatTile label="Scored" value={String(scoredCount)} />
      </div>

      <div className="flex flex-col gap-3">
        <FilterPills
          options={categoryOptions}
          value={categoryFilter}
          onChange={setCategoryFilter}
          aria-label="Feature categories"
        />
        <FilterPills
          options={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
          aria-label="Feature statuses"
        />
      </div>

      {catalogQuery.isLoading ? (
        <div className="text-silver-400 flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading feature catalog…
        </div>
      ) : null}

      {!catalogQuery.isLoading && features.length === 0 ? (
        <Panel className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-silver-300 text-sm">No features match the current filters.</p>
          {hasActiveFilters ? (
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </Panel>
      ) : (
        <FeatureStoreTable
          features={features}
          loading={catalogQuery.isLoading}
          onSelectFeature={(name) => onSelectFeature?.(name)}
        />
      )}
    </Panel>
  )
}
