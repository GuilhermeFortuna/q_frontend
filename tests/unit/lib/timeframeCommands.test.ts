import { describe, expect, it } from 'vitest'

import { parseTimeframeInput } from '@/lib/market/timeframeCommands'

describe('parseTimeframeInput', () => {
  it.each([
    ['60m', { label: 'Switch to 1 Hour', value: '1H' }],
    ['60 min', { label: 'Switch to 1 Hour', value: '1H' }],
    ['1h', { label: 'Switch to 1 Hour', value: '1H' }],
    ['4h', { label: 'Switch to 4 Hours', value: '4H' }],
    ['daily', { label: 'Switch to 1 Day (Daily)', value: '1D' }],
    ['1d', { label: 'Switch to 1 Day (Daily)', value: '1D' }],
    ['15m', { label: 'Switch to 15 Minutes', value: '15m' }],
    ['7m', null],
    ['', null],
    ['abc', null],
  ])('parses %s', (input, expected) => {
    expect(parseTimeframeInput(input)).toEqual(expected)
  })
})
