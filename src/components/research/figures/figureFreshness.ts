import { useCallback, useEffect, useRef, useState } from 'react'

import type { ResearchFigure } from '@/types/researchFigures'

export type FigureMark = 'new' | 'updated'

/**
 * Compare the revisions seen so far with the current list. A figure whose revision
 * went up is `updated`. An unseen figure in the first `leadingCount` entries is `new`:
 * the first page is where a freshly published figure lands, while figures loaded by
 * "Load more" come after and are only backfill. A replaced figure can sort above an
 * arrival from the same poll window, so position within the page is not used.
 */
export function diffFigureRevisions(
  previous: ReadonlyMap<string, number>,
  current: readonly Pick<ResearchFigure, 'figure_id' | 'revision'>[],
  leadingCount: number = current.length,
): Record<string, FigureMark> {
  const marks: Record<string, FigureMark> = {}
  current.forEach((figure, index) => {
    const seenRevision = previous.get(figure.figure_id)
    if (seenRevision === undefined) {
      if (index < leadingCount) marks[figure.figure_id] = 'new'
    } else if (figure.revision > seenRevision) {
      marks[figure.figure_id] = 'updated'
    }
  })
  return marks
}

type Baseline = { scope: string; revisions: Map<string, number> }

/**
 * Tracks New and Updated figures across polls for one list scope (for example one
 * collection). The first list loaded for a scope is the baseline and marks nothing;
 * switching scope starts a new baseline, so opening a collection never marks it all.
 * `leadingCount` is the length of the first page, the only part that can hold arrivals.
 */
export function useFigureFreshness(
  figures: readonly ResearchFigure[] | undefined,
  scope: string,
  leadingCount?: number,
) {
  const baselineRef = useRef<Baseline | null>(null)
  const [marks, setMarks] = useState<Record<string, FigureMark>>({})

  useEffect(() => {
    if (!figures) return

    const previous = baselineRef.current
    const sameScope = previous?.scope === scope
    const changes = sameScope
      ? diffFigureRevisions(previous.revisions, figures, leadingCount ?? figures.length)
      : {}
    // The baseline accumulates every figure seen in this scope, so pages loaded later
    // are remembered and do not count as new when they arrive.
    const revisions = sameScope ? new Map(previous.revisions) : new Map<string, number>()
    for (const figure of figures) revisions.set(figure.figure_id, figure.revision)
    baselineRef.current = { scope, revisions }

    if (Object.keys(changes).length === 0) return
    setMarks((current) => ({ ...current, ...changes }))
  }, [figures, scope, leadingCount])

  const clearMark = useCallback((figureId: string) => {
    setMarks((current) => {
      if (!(figureId in current)) return current
      const next = { ...current }
      delete next[figureId]
      return next
    })
  }, [])

  return { marks, clearMark }
}
