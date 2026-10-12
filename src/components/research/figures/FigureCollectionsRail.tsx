import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/Panel'
import type { ResearchFigureCollection } from '@/types/researchFigures'

import { formatFigureUpdated, sortCollectionsNewestFirst } from './figureUtils'

type RailItemProps = {
  label: string
  detail?: string
  count: number
  active: boolean
  testId: string
  onSelect: () => void
}

function RailItem({ label, detail, count, active, testId, onSelect }: RailItemProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      data-testid={testId}
      onClick={onSelect}
      className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
        active ? 'accent-state text-gold-400' : 'text-silver-300 hover:bg-white/5'
      }`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{label}</span>
        {detail ? <span className="text-silver-400 truncate text-[11px]">{detail}</span> : null}
      </span>
      <span className="text-silver-400 shrink-0 font-mono text-xs tabular-nums">{count}</span>
    </button>
  )
}

type FigureCollectionsRailProps = {
  collections: readonly ResearchFigureCollection[]
  totalCount: number
  selected: string | null
  onSelect: (collection: string | null) => void
  onDeleteCollection: (collection: string) => void
}

export function FigureCollectionsRail({
  collections,
  totalCount,
  selected,
  onSelect,
  onDeleteCollection,
}: FigureCollectionsRailProps) {
  return (
    <Panel
      className="flex w-56 shrink-0 flex-col gap-2 overflow-hidden p-3"
      data-testid="figure-collections"
    >
      <nav
        aria-label="Figure collections"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
      >
        <RailItem
          label="All figures"
          count={totalCount}
          active={selected === null}
          testId="figure-collection-all"
          onSelect={() => onSelect(null)}
        />
        {sortCollectionsNewestFirst(collections).map((collection) => (
          <RailItem
            key={collection.name}
            label={collection.name}
            detail={`Updated ${formatFigureUpdated(collection.updated_at)}`}
            count={collection.count}
            active={selected === collection.name}
            testId={`figure-collection-${collection.name}`}
            onSelect={() => onSelect(collection.name)}
          />
        ))}
      </nav>
      {selected ? (
        <Button
          type="button"
          variant="ghost"
          className="justify-start text-rose-400 hover:text-rose-300"
          onClick={() => onDeleteCollection(selected)}
          data-testid="figure-delete-collection"
        >
          Delete collection
        </Button>
      ) : null}
    </Panel>
  )
}
