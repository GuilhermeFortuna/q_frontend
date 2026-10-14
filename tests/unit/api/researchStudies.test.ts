import { describe, expect, it } from 'vitest'

import { researchStudyKeys } from '@/api/queries/researchStudies'

describe('research study query keys', () => {
  it('change with the revision, so a replaced study refetches its values', () => {
    const before = researchStudyKeys.series(
      'study-1',
      1,
      '2026-01-05T13:00:00Z',
      '2026-01-05T13:30:00Z',
    )
    const after = researchStudyKeys.series(
      'study-1',
      2,
      '2026-01-05T13:00:00Z',
      '2026-01-05T13:30:00Z',
    )
    expect(after).not.toEqual(before)
  })

  it('scope the list to one symbol', () => {
    expect(researchStudyKeys.list('WDO$N')).not.toEqual(researchStudyKeys.list('WDOV26'))
  })
})
