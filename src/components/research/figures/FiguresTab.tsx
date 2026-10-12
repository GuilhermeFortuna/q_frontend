import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { useBulkDeleteResearchFigures, useResearchFigureList } from '@/api/queries/researchFigures'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Panel } from '@/components/ui/Panel'
import { toast } from '@/components/ui/toast'

import { FigureCard } from './FigureCard'
import { FigureCollectionsRail } from './FigureCollectionsRail'
import { useFigureFreshness } from './figureFreshness'
import { RESEARCH_FIGURE_SNIPPET, sortFiguresNewestFirst, totalFigureCount } from './figureUtils'

const SKELETON_COUNT = 6

export function FiguresTab() {
  const navigate = useNavigate({ from: '/research' })
  const [collection, setCollection] = useState<string | null>(null)
  const [titleFilter, setTitleFilter] = useState('')
  const [pendingDeleteCollection, setPendingDeleteCollection] = useState<string | null>(null)

  const list = useResearchFigureList({ collection })
  const bulkDelete = useBulkDeleteResearchFigures()

  const pages = list.data?.pages
  // `collections` covers the whole store, so counts do not change with the selection.
  const collections = pages?.[0]?.collections ?? []
  const figures = useMemo(() => pages?.flatMap((page) => page.items), [pages])
  const totalCount = totalFigureCount(collections)

  const { marks, clearMark } = useFigureFreshness(figures, collection ?? '')

  const visibleFigures = useMemo(() => {
    const sorted = sortFiguresNewestFirst(figures ?? [])
    const query = titleFilter.trim().toLowerCase()
    return query ? sorted.filter((figure) => figure.title.toLowerCase().includes(query)) : sorted
  }, [figures, titleFilter])

  const openFigure = (figureId: string) => {
    clearMark(figureId)
    void navigate({ search: { tab: 'figures', figure: figureId } })
  }

  const confirmDeleteCollection = () => {
    if (!pendingDeleteCollection) return
    const name = pendingDeleteCollection
    bulkDelete.mutate(
      { collection: name },
      {
        onSuccess: (result) => {
          toast.success(`Deleted collection “${name}” (${result.deleted} figures)`)
          setCollection(null)
        },
        onError: () => toast.error(`Could not delete collection “${name}”.`),
        onSettled: () => setPendingDeleteCollection(null),
      },
    )
  }

  const pendingCount =
    collections.find((entry) => entry.name === pendingDeleteCollection)?.count ?? 0

  let body: ReactNode
  if (list.isPending) {
    body = (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3" aria-busy="true">
        <span className="sr-only" role="status">
          Loading figures
        </span>
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="h-56 rounded-lg bg-white/5 motion-safe:animate-pulse"
          />
        ))}
      </div>
    )
  } else if (list.isError && !figures) {
    body = (
      <div role="alert" className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm text-rose-300">Figures could not be loaded.</p>
        <Button type="button" variant="outline" onClick={() => void list.refetch()}>
          Retry
        </Button>
      </div>
    )
  } else if (totalCount === 0) {
    body = (
      <div className="flex flex-col gap-3 p-4" data-testid="figures-empty">
        <p className="text-cream-300 text-sm">
          No figures yet. A research script publishes a Matplotlib or Plotly figure with{' '}
          <code className="font-mono">research.publish_figure</code>, and it appears here within
          seconds.
        </p>
        <pre className="text-silver-200 bg-carbon-950/60 overflow-x-auto rounded-md p-3 font-mono text-xs">
          {RESEARCH_FIGURE_SNIPPET}
        </pre>
      </div>
    )
  } else if (visibleFigures.length === 0) {
    body = (
      <p className="text-silver-400 p-4 text-sm" data-testid="figures-no-match">
        {titleFilter.trim() ? 'No figures match this title.' : 'This collection has no figures.'}
      </p>
    )
  } else {
    body = (
      <div className="flex flex-col gap-4">
        <ul
          className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3"
          data-testid="figures-grid"
        >
          {visibleFigures.map((figure) => (
            <li key={figure.figure_id} className="min-w-0">
              <FigureCard
                figure={figure}
                mark={marks[figure.figure_id]}
                showCollection={collection === null}
                onOpen={openFigure}
              />
            </li>
          ))}
        </ul>
        {list.hasNextPage ? (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden" data-testid="research-tab-figures">
      <FigureCollectionsRail
        collections={collections}
        totalCount={totalCount}
        selected={collection}
        onSelect={setCollection}
        onDeleteCollection={setPendingDeleteCollection}
      />
      <Panel className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-cream-200 text-sm font-medium">{collection ?? 'All figures'}</h2>
          <input
            type="search"
            aria-label="Filter figures by title"
            placeholder="Filter by title"
            value={titleFilter}
            onChange={(event) => setTitleFilter(event.target.value)}
            className="bg-carbon-950/60 text-silver-200 w-56 rounded-md border border-white/10 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{body}</div>
      </Panel>
      <ConfirmDialog
        open={pendingDeleteCollection !== null}
        title="Delete collection?"
        description={`Delete “${pendingDeleteCollection ?? ''}” and its ${pendingCount} figures? This cannot be undone.`}
        confirmLabel="Delete collection"
        loading={bulkDelete.isPending}
        onConfirm={confirmDeleteCollection}
        onCancel={() => setPendingDeleteCollection(null)}
      />
    </div>
  )
}
