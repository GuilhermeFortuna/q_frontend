import { describe, expect, it } from 'vitest'

import {
  isMaxWorkersInputInvalid,
  parseMaxWorkersInput,
  withMaxWorkers,
} from '@/lib/optimize/studyConfig'

describe('studyConfig max_workers helpers', () => {
  it('omits max_workers when the worker field is empty', () => {
    const study = withMaxWorkers(
      {
        name: 'test',
        n_trials: 10,
      },
      '',
    )

    expect(study).not.toHaveProperty('max_workers')
  })

  it('sets max_workers when the worker field has a positive integer', () => {
    const study = withMaxWorkers(
      {
        name: 'test',
        n_trials: 10,
      },
      '4',
    )

    expect(study.max_workers).toBe(4)
  })

  it('treats whitespace-only input as auto', () => {
    expect(parseMaxWorkersInput('   ')).toBeUndefined()
    expect(isMaxWorkersInputInvalid('   ')).toBe(false)
  })

  it('flags invalid worker input', () => {
    expect(isMaxWorkersInputInvalid('0')).toBe(true)
    expect(isMaxWorkersInputInvalid('2.5')).toBe(true)
    expect(isMaxWorkersInputInvalid('abc')).toBe(true)
  })
})
