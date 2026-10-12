import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ResearchFigure } from '@/types/researchFigures'

import { diffFigureRevisions, useFigureFreshness } from '../figureFreshness'

function figure(id: string, revision: number): ResearchFigure {
  return {
    figure_id: id,
    title: id,
    collection: 'c',
    kind: 'image',
    media_type: 'image/png',
    byte_size: 1,
    revision,
    created_at: '2026-10-12T09:00:00Z',
    updated_at: '2026-10-12T09:00:00Z',
    width: null,
    height: null,
    notes: null,
    provenance: null,
  } as ResearchFigure
}

describe('diffFigureRevisions', () => {
  it('marks unseen figures on the first page as new and higher revisions as updated', () => {
    const previous = new Map([
      ['a', 1],
      ['b', 2],
    ])
    const marks = diffFigureRevisions(previous, [figure('c', 1), figure('a', 1), figure('b', 3)], 3)

    expect(marks).toEqual({ b: 'updated', c: 'new' })
  })

  it('treats unseen figures beyond the first page as backfill, not new', () => {
    const previous = new Map([
      ['a', 1],
      ['b', 1],
    ])
    const marks = diffFigureRevisions(
      previous,
      [figure('a', 1), figure('b', 1), figure('old', 1)],
      2,
    )

    expect(marks).toEqual({})
  })

  it('marks a new figure above a replaced one from the same poll window', () => {
    const previous = new Map([
      ['b', 1],
      ['c', 1],
    ])
    // `b` was replaced, so it now sorts first; the new figure `a` is second.
    const marks = diffFigureRevisions(previous, [figure('b', 2), figure('a', 1), figure('c', 1)], 3)

    expect(marks).toEqual({ b: 'updated', a: 'new' })
  })

  it('marks nothing when the list is unchanged', () => {
    const previous = new Map([['a', 1]])
    expect(diffFigureRevisions(previous, [figure('a', 1)])).toEqual({})
  })
})

describe('useFigureFreshness', () => {
  it('treats the first list for a scope as the baseline and marks nothing', () => {
    const { result } = renderHook(({ figures, scope }) => useFigureFreshness(figures, scope), {
      initialProps: { figures: [figure('a', 1)] as ResearchFigure[] | undefined, scope: 'x' },
    })

    expect(result.current.marks).toEqual({})
  })

  it('marks a figure that arrives on a later list, and clears it when opened', () => {
    const { result, rerender } = renderHook(
      ({ figures, scope }) => useFigureFreshness(figures, scope),
      { initialProps: { figures: [figure('a', 1)] as ResearchFigure[] | undefined, scope: 'x' } },
    )

    rerender({ figures: [figure('b', 1), figure('a', 1)], scope: 'x' })
    expect(result.current.marks).toEqual({ b: 'new' })

    act(() => result.current.clearMark('b'))
    expect(result.current.marks).toEqual({})
  })

  it('marks a replaced figure as updated and keeps the mark until it is opened', () => {
    const { result, rerender } = renderHook(
      ({ figures, scope }) => useFigureFreshness(figures, scope),
      { initialProps: { figures: [figure('a', 1)] as ResearchFigure[] | undefined, scope: 'x' } },
    )

    rerender({ figures: [figure('a', 2)], scope: 'x' })
    expect(result.current.marks).toEqual({ a: 'updated' })

    rerender({ figures: [figure('a', 2)], scope: 'x' })
    expect(result.current.marks).toEqual({ a: 'updated' })
  })

  it('does not mark older figures loaded by "Load more"', () => {
    const { result, rerender } = renderHook(
      ({ figures, leadingCount }) => useFigureFreshness(figures, 'x', leadingCount),
      {
        initialProps: {
          figures: [figure('a', 1), figure('b', 1)] as ResearchFigure[] | undefined,
          leadingCount: 2,
        },
      },
    )

    rerender({
      figures: [figure('a', 1), figure('b', 1), figure('old1', 1), figure('old2', 1)],
      leadingCount: 2,
    })
    expect(result.current.marks).toEqual({})
  })

  it('still marks a new arrival after older figures were loaded', () => {
    const { result, rerender } = renderHook(
      ({ figures, leadingCount }) => useFigureFreshness(figures, 'x', leadingCount),
      {
        initialProps: {
          figures: [figure('a', 1), figure('b', 1)] as ResearchFigure[] | undefined,
          leadingCount: 2,
        },
      },
    )

    rerender({ figures: [figure('a', 1), figure('b', 1), figure('old1', 1)], leadingCount: 2 })
    rerender({
      figures: [figure('new', 1), figure('a', 1), figure('b', 1), figure('old1', 1)],
      leadingCount: 2,
    })

    expect(result.current.marks).toEqual({ new: 'new' })
  })

  it('does not mark a whole collection when the user switches to it', () => {
    const { result, rerender } = renderHook(
      ({ figures, scope }) => useFigureFreshness(figures, scope),
      { initialProps: { figures: [figure('a', 1)] as ResearchFigure[] | undefined, scope: 'x' } },
    )

    rerender({ figures: undefined, scope: 'y' })
    rerender({ figures: [figure('z', 1), figure('w', 1)], scope: 'y' })

    expect(result.current.marks).toEqual({})
  })
})
