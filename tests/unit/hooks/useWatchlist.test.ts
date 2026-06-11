import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'

import { useWatchlist } from '@/hooks/useWatchlist'
import type { Instrument } from '@/types/api'

const seedInstruments: Instrument[] = [
  { symbol: 'PETR4', name: 'PETROBRAS PN N2', exchange: 'BOVESPA', assetClass: 'equity' },
  { symbol: 'VALE3', name: 'VALE ON NM', exchange: 'BOVESPA', assetClass: 'equity' },
]

describe('useWatchlist', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('seeds from instruments when localStorage is empty', () => {
    const { result, rerender } = renderHook(({ instruments }) => useWatchlist(instruments), {
      initialProps: { instruments: undefined as Instrument[] | undefined },
    })

    expect(result.current.watchlist).toEqual([])

    rerender({ instruments: seedInstruments })

    expect(result.current.watchlist).toEqual(seedInstruments)
    expect(JSON.parse(localStorage.getItem('quant_watchlist') || '[]')).toEqual(seedInstruments)
  })

  it('adds and removes instruments while persisting to localStorage', () => {
    localStorage.setItem('quant_watchlist', JSON.stringify([seedInstruments[0]]))

    const { result } = renderHook(() => useWatchlist(seedInstruments))

    act(() => {
      result.current.addToWatchlist(seedInstruments[1])
    })

    expect(result.current.watchlist.map((item) => item.symbol)).toEqual(['PETR4', 'VALE3'])

    act(() => {
      result.current.removeFromWatchlist('PETR4')
    })

    expect(result.current.watchlist).toEqual([seedInstruments[1]])
    expect(JSON.parse(localStorage.getItem('quant_watchlist') || '[]')).toEqual([
      seedInstruments[1],
    ])
  })
})
