import { EMPTY_REPLAY_FORM, type ReplayForm } from '@/workspaces/replay/replayControls'

/** Local storage key of the replay start form. Per browser; nothing here is shared or sent. */
export const REPLAY_FORM_STORAGE_KEY = 'q.replay.startForm.v1'

const FIELDS = Object.keys(EMPTY_REPLAY_FORM) as (keyof ReplayForm)[]

/** The last values typed into the start form, or the defaults when none are saved or readable. */
export function loadReplayForm(): ReplayForm {
  try {
    const raw = window.localStorage.getItem(REPLAY_FORM_STORAGE_KEY)
    if (!raw) return { ...EMPTY_REPLAY_FORM }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...EMPTY_REPLAY_FORM }
    const saved = parsed as Record<string, unknown>
    const form: ReplayForm = { ...EMPTY_REPLAY_FORM }
    for (const field of FIELDS) {
      const value = saved[field]
      if (typeof value === 'string') form[field] = value
    }
    return form
  } catch {
    return { ...EMPTY_REPLAY_FORM }
  }
}

/** Remembers the form's values. Storage being unavailable only means the values are not kept. */
export function saveReplayForm(form: ReplayForm): void {
  try {
    window.localStorage.setItem(REPLAY_FORM_STORAGE_KEY, JSON.stringify(form))
  } catch {
    // Storage is full or blocked: the form still works, it just does not remember.
  }
}
