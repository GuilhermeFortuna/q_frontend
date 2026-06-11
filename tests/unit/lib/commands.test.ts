import { describe, expect, it } from 'vitest'

import { commandActionLabel, commandSearchQuery, parseCommand } from '@/lib/market/commands'

describe('parseCommand', () => {
  const cases: Array<{
    input: string
    expected: ReturnType<typeof parseCommand>
  }> = [
    { input: '', expected: null },
    { input: '   ', expected: null },
    { input: '+', expected: null },
    { input: '+PETR4', expected: { kind: 'add-to-watchlist', symbolQuery: 'PETR4' } },
    { input: '+ PETR4', expected: { kind: 'add-to-watchlist', symbolQuery: 'PETR4' } },
    { input: '+petr4', expected: { kind: 'add-to-watchlist', symbolQuery: 'petr4' } },
    { input: '-PETR4', expected: { kind: 'remove-from-watchlist', symbolQuery: 'PETR4' } },
    { input: '- PETR4', expected: { kind: 'remove-from-watchlist', symbolQuery: 'PETR4' } },
    { input: '-vale3', expected: { kind: 'remove-from-watchlist', symbolQuery: 'vale3' } },
    {
      input: 'PETR4 1H',
      expected: {
        kind: 'symbol-timeframe',
        symbolQuery: 'PETR4',
        timeframe: { label: 'Switch to 1 Hour', value: '1H' },
      },
    },
    {
      input: 'vale3 1d',
      expected: {
        kind: 'symbol-timeframe',
        symbolQuery: 'vale3',
        timeframe: { label: 'Switch to 1 Day (Daily)', value: '1D' },
      },
    },
    { input: 'PETR4', expected: null },
    { input: '1H', expected: null },
    { input: 'garbage input', expected: null },
    { input: '++PETR4', expected: null },
  ]

  it.each(cases)('parseCommand($input)', ({ input, expected }) => {
    expect(parseCommand(input)).toEqual(expected)
  })

  it('extracts search query from parsed commands', () => {
    expect(commandSearchQuery('+ PETR4', parseCommand('+ PETR4'))).toBe('PETR4')
    expect(commandSearchQuery('-VALE3', parseCommand('-VALE3'))).toBe('VALE3')
    expect(commandSearchQuery('PETR4 1H', parseCommand('PETR4 1H'))).toBe('PETR4')
    expect(commandSearchQuery('plain', null)).toBe('plain')
  })

  it('builds readable command labels', () => {
    expect(commandActionLabel({ kind: 'add-to-watchlist', symbolQuery: 'PETR4' })).toContain(
      'PETR4',
    )
    expect(commandActionLabel({ kind: 'remove-from-watchlist', symbolQuery: 'VALE3' })).toContain(
      'VALE3',
    )
    expect(
      commandActionLabel({
        kind: 'symbol-timeframe',
        symbolQuery: 'PETR4',
        timeframe: { label: 'Switch to 1 Hour', value: '1H' },
      }),
    ).toContain('PETR4')
  })
})
