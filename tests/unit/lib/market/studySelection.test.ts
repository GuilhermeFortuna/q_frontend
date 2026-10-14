import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  MARKET_STUDIES_STORAGE_KEY,
  pruneEnabledStudyIds,
  writeEnabledStudyIds,
} from '@/lib/market/studySelection'

describe('study selection', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('stores enabled ids per symbol under quant:market-studies', () => {
    writeEnabledStudyIds('WDO$N', ['a', 'b', 'a'])
    writeEnabledStudyIds('WDOV26', ['c'])

    const stored = JSON.parse(window.localStorage.getItem(MARKET_STUDIES_STORAGE_KEY) ?? '{}')
    expect(stored).toEqual({ WDO$N: ['a', 'b'], WDOV26: ['c'] })
  })

  it('keeps the selection of a symbol when another symbol is written', () => {
    writeEnabledStudyIds('WDO$N', ['a'])
    writeEnabledStudyIds('WDOV26', ['c'])
    writeEnabledStudyIds('WDO$N', ['a', 'd'])

    const stored = JSON.parse(window.localStorage.getItem(MARKET_STUDIES_STORAGE_KEY) ?? '{}')
    expect(stored['WDOV26']).toEqual(['c'])
    expect(stored['WDO$N']).toEqual(['a', 'd'])
  })

  it('drops stored ids that no longer name a study', () => {
    expect(pruneEnabledStudyIds(['a', 'gone'], ['a', 'b'])).toEqual(['a'])
    expect(pruneEnabledStudyIds(['gone'], [])).toEqual([])
  })

  it('does not throw when storage holds invalid JSON or the write is refused', () => {
    window.localStorage.setItem(MARKET_STUDIES_STORAGE_KEY, '{not json')
    expect(() => writeEnabledStudyIds('WDO$N', ['a'])).not.toThrow()

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => writeEnabledStudyIds('WDO$N', ['b'])).not.toThrow()
  })
})
