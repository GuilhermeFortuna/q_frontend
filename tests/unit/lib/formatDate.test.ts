import { describe, expect, it } from 'vitest'

import {
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayMonth,
  formatDisplayTime,
} from '@/lib/formatDate'

describe('formatDate', () => {
  const sample = new Date(2021, 5, 2, 12, 0, 0)

  it('formats display date as YYYY/MM/DD', () => {
    expect(formatDisplayDate(sample)).toMatch(/^\d{4}\/\d{2}\/\d{2}$/)
    expect(formatDisplayDate(sample)).toBe('2021/06/02')
  })

  it('formats display datetime as YYYY/MM/DD HH:mm:ss', () => {
    const formatted = formatDisplayDateTime(sample)
    expect(formatted).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('formats display month as YYYY/MM', () => {
    expect(formatDisplayMonth(sample)).toBe('2021/06')
  })

  it('formats display time as HH:mm', () => {
    expect(formatDisplayTime(sample)).toMatch(/^\d{2}:\d{2}$/)
  })
})
