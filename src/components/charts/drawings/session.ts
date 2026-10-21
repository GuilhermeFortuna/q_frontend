import type { DrawingObject } from '@/components/charts/drawings/model'

/** Undo depth kept per symbol for the lifetime of the page. */
export const MAX_HISTORY_STEPS = 50

/**
 * The drawings of one symbol plus their undo and redo snapshots. Every change is a whole-list
 * snapshot, so undo and redo restore creation, moves, style edits, deletions and clears alike.
 */
export type DrawingSession = {
  drawings: DrawingObject[]
  past: DrawingObject[][]
  future: DrawingObject[][]
  /** Messages to show in the chart until the next successful save. */
  notices: string[]
  /** True when `drawings` has changed since it was last written to storage. */
  dirty: boolean
}

export function startSession(drawings: DrawingObject[], notices: string[]): DrawingSession {
  return { drawings, past: [], future: [], notices, dirty: false }
}

/** Records `next` as the current drawings, keeping the previous list for undo. */
export function commitDrawings(session: DrawingSession, next: DrawingObject[]): DrawingSession {
  if (next === session.drawings) return session
  return {
    ...session,
    drawings: next,
    past: [...session.past, session.drawings].slice(-MAX_HISTORY_STEPS),
    future: [],
    dirty: true,
  }
}

export function undoDrawings(session: DrawingSession): DrawingSession {
  const previous = session.past[session.past.length - 1]
  if (!previous) return session
  return {
    ...session,
    drawings: previous,
    past: session.past.slice(0, -1),
    future: [session.drawings, ...session.future],
    dirty: true,
  }
}

export function redoDrawings(session: DrawingSession): DrawingSession {
  const [next, ...rest] = session.future
  if (!next) return session
  return {
    ...session,
    drawings: next,
    past: [...session.past, session.drawings].slice(-MAX_HISTORY_STEPS),
    future: rest,
    dirty: true,
  }
}
