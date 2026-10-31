import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EMPTY_REPLAY_FORM, type ReplayForm } from '@/workspaces/replay/replayControls'
import {
  loadReplayForm,
  REPLAY_FORM_STORAGE_KEY,
  saveReplayForm,
} from '@/workspaces/replay/replayFormStorage'

const SAVED: ReplayForm = {
  symbol: 'WDO$N',
  startDay: '2026-10-01',
  endDay: '2026-10-09',
  initialCapital: '25000.00',
  pointValue: '10',
  priceTick: '0.5',
}

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('replay form storage', () => {
  it('returns the saved values after a save', () => {
    saveReplayForm(SAVED)
    expect(loadReplayForm()).toEqual(SAVED)
  })

  it('returns the defaults when nothing is saved', () => {
    expect(loadReplayForm()).toEqual(EMPTY_REPLAY_FORM)
  })

  it('returns the defaults for unreadable or unexpected content', () => {
    window.localStorage.setItem(REPLAY_FORM_STORAGE_KEY, '{not json')
    expect(loadReplayForm()).toEqual(EMPTY_REPLAY_FORM)
    window.localStorage.setItem(REPLAY_FORM_STORAGE_KEY, '42')
    expect(loadReplayForm()).toEqual(EMPTY_REPLAY_FORM)
  })

  it('keeps the saved fields it recognises and ignores the rest', () => {
    window.localStorage.setItem(
      REPLAY_FORM_STORAGE_KEY,
      JSON.stringify({ symbol: 'WIN$N', pointValue: 0.2, unknown: 'x' }),
    )
    const loaded = loadReplayForm()
    expect(loaded.symbol).toBe('WIN$N')
    expect(loaded.pointValue).toBe(EMPTY_REPLAY_FORM.pointValue)
    expect(loaded).not.toHaveProperty('unknown')
  })

  it('still works when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => saveReplayForm(SAVED)).not.toThrow()
    expect(loadReplayForm()).toEqual(EMPTY_REPLAY_FORM)
  })
})
