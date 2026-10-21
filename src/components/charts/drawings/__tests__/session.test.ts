import { describe, expect, it } from 'vitest'

import type { DrawingObject } from '@/components/charts/drawings/model'
import {
  MAX_HISTORY_STEPS,
  commitDrawings,
  redoDrawings,
  startSession,
  undoDrawings,
} from '@/components/charts/drawings/session'

const hline = (id: string, price: number): DrawingObject => ({
  id,
  type: 'hline',
  anchors: [{ time: 0, price }],
  style: { color: '#c9a227', width: 1, lineStyle: 'solid' },
  locked: false,
  hidden: false,
  options: {},
})

describe('drawing session history', () => {
  it('undoes and redoes whole-list changes in order', () => {
    const a = hline('a', 1)
    const b = hline('b', 2)
    let session = startSession([], [])
    session = commitDrawings(session, [a])
    session = commitDrawings(session, [a, b])
    expect(session.dirty).toBe(true)

    session = undoDrawings(session)
    expect(session.drawings).toEqual([a])
    session = undoDrawings(session)
    expect(session.drawings).toEqual([])
    expect(undoDrawings(session)).toBe(session)

    session = redoDrawings(session)
    expect(session.drawings).toEqual([a])
    session = redoDrawings(session)
    expect(session.drawings).toEqual([a, b])
    expect(redoDrawings(session)).toBe(session)
  })

  it('drops the redo branch on a new change', () => {
    const a = hline('a', 1)
    let session = commitDrawings(startSession([], []), [a])
    session = undoDrawings(session)
    session = commitDrawings(session, [hline('c', 3)])
    expect(session.future).toEqual([])
  })

  it('ignores a commit that does not change the list', () => {
    const session = startSession([hline('a', 1)], [])
    expect(commitDrawings(session, session.drawings)).toBe(session)
  })

  it('keeps at most the configured number of undo steps', () => {
    let session = startSession([], [])
    for (let index = 0; index < MAX_HISTORY_STEPS + 10; index += 1) {
      session = commitDrawings(session, [hline(`d${index}`, index)])
    }
    expect(session.past).toHaveLength(MAX_HISTORY_STEPS)
  })
})
