import { describe, expect, it } from 'vitest'

import { normalizeLeadingZero, parseNumberInput } from '@/lib/numberInput'

describe('normalizeLeadingZero', () => {
  it('replaces a lone zero when another digit is typed', () => {
    expect(normalizeLeadingZero('0', '05')).toBe('5')
  })

  it('preserves decimal values that start with zero', () => {
    expect(normalizeLeadingZero('0', '0.5')).toBe('0.5')
  })

  it('leaves unrelated edits unchanged', () => {
    expect(normalizeLeadingZero('10', '105')).toBe('105')
  })
})

describe('parseNumberInput', () => {
  it('returns null for empty or partial input', () => {
    expect(parseNumberInput('')).toBeNull()
    expect(parseNumberInput('-')).toBeNull()
    expect(parseNumberInput('.')).toBeNull()
  })

  it('parses integers when requested', () => {
    expect(parseNumberInput('42', true)).toBe(42)
  })

  it('parses floats by default', () => {
    expect(parseNumberInput('3.14')).toBe(3.14)
  })
})
