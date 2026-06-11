import { describe, expect, it } from 'vitest'

import {
  DISPLAY_TIMEZONE,
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayMonth,
  formatDisplayMonthKey,
  formatDisplayTime,
  formatDisplayTimeSeconds,
} from '@/lib/formatDate'

describe('formatDate', () => {
  // 2024-01-01 15:00:00 UTC = 2024-01-01 12:00:00 Brasília (UTC-3)
  const utcNoonBrt = '2024-01-01T15:00:00Z'

  it('uses Brasília as the display timezone', () => {
    expect(DISPLAY_TIMEZONE).toBe('America/Sao_Paulo')
  })

  it('formats display date as YYYY/MM/DD in Brasília', () => {
    expect(formatDisplayDate(utcNoonBrt)).toBe('2024/01/01')
  })

  it('formats display datetime as YYYY/MM/DD HH:mm:ss in Brasília', () => {
    expect(formatDisplayDateTime(utcNoonBrt)).toBe('2024/01/01 12:00:00')
  })

  it('formats display month as YYYY/MM in Brasília', () => {
    expect(formatDisplayMonth(utcNoonBrt)).toBe('2024/01')
  })

  it('formats display time as HH:mm in Brasília', () => {
    expect(formatDisplayTime(utcNoonBrt)).toBe('12:00')
  })

  it('formats display time with seconds in Brasília', () => {
    expect(formatDisplayTimeSeconds(utcNoonBrt)).toBe('12:00:00')
  })

  it('formats month key for aggregation in Brasília', () => {
    expect(formatDisplayMonthKey(utcNoonBrt)).toBe('2024-01')
  })

  it('formats a proper UTC API timestamp for a 9 AM Brasília session bar', () => {
    expect(formatDisplayDateTime('2023-12-10T12:00:00Z')).toBe('2023/12/10 09:00:00')
  })

  it('treats naive ISO timestamps as Brasília local', () => {
    expect(formatDisplayDateTime('2023-12-10T09:00:00')).toBe('2023/12/10 09:00:00')
  })
})
