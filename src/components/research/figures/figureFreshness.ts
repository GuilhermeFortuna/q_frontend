import { useCallback, useEffect, useRef, useState } from 'react'

import type { ResearchFigure } from '@/types/researchFigures'

export type FigureMark = 'new' | 'updated'

/**
 * Compare the revisions seen on the previous poll with the current list. A figure
 * that was absent is `new`; one whose revision went up is `updated`. Unchanged
 * figures get no mark.
 */
export function diffFigureRevisions(
  previous: ReadonlyMap<string, number>,
  current: readonly Pick<ResearchFigure, 'figure_id' | 'revision'>[],
): Record<string, FigureMark> {
  const marks: Record<string, FigureMark> = {}
  for (const figure of current) {
    const seenRevision = previous.get(figure.figure_id)
    if (seenRevision === undefined) marks[figure.figure_id] = 'new'
    else if (figure.revision > seenRevision) marks[figure.figure_id] = 'updated'
  }
  return marks
}

type Baseline = { scope: string; revisions: Map<string, number> }

/**
 * Tracks New and Updated figures across polls for one list scope (for example one
 * collection). The first list loaded for a scope is the baseline and marks nothing;
 * switching scope starts a new baseline, so opening a collection never marks it all.
 */
export function useFigureFreshness(figures: readonly ResearchFigure[] | undefined, scope: string) {
  const baselineRef = useRef<Baseline | null>(null)
  const [marks, setMarks] = useState<Record<string, FigureMark>>({})

  useEffect(() => {
    if (!figures) return

    const previous = baselineRef.current
    baselineRef.current = {
      scope,
      revisions: new Map(figures.map((figure) => [figure.figure_id, figure.revision])),
    }
    if (!previous || previous.scope !== scope) return

    const changes = diffFigureRevisions(previous.revisions, figures)
    if (Object.keys(changes).length === 0) return
    setMarks((current) => ({ ...current, ...changes }))
  }, [figures, scope])

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
