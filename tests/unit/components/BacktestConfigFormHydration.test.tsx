import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { BacktestConfigForm } from '@/components/backtests/BacktestConfigForm'
import { useAppStore } from '@/store/useAppStore'

vi.mock('@/api/queries/market-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/queries/market-data')>()
  return { ...actual, fetchOhlcvAvailableRange: vi.fn() }
})

describe('BacktestConfigForm — hydration from pending config', () => {
  it('hydrates fields from a staged config and clears it', async () => {
    useAppStore.getState().setPendingBacktestConfig({
      symbol: 'VALE3',
      timeframe: 'H1',
      start: '2024-03-01T00:00:00.000Z',
      end: '2024-06-01T00:00:00.000Z',
      initial_capital: 250000,
      point_value: 10,
      strategy: 'MACrossover',
      strategy_params: { short_period: 12, long_period: 48, threshold: 1.25 },
      position_sizing: { type: 'fixed_quantity', quantity: 4 },
    })

    render(<BacktestConfigForm loading={false} error={null} onSubmit={vi.fn()} />)

    const symbolInput = screen.getByPlaceholderText('e.g. PETR4') as HTMLInputElement
    expect(symbolInput.value).toBe('VALE3')
    expect(screen.getByDisplayValue('250000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('12')).toBeInTheDocument()
    expect(screen.getByDisplayValue('48')).toBeInTheDocument()

    await waitFor(() => {
      expect(useAppStore.getState().pendingBacktestConfig).toBeNull()
    })
  })
})
