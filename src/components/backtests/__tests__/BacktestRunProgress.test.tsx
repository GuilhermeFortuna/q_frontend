import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { BacktestStatusResponse } from '../../../../contracts/api'
import {
  BacktestRunProgress,
  STALL_AFTER_MS,
  backtestPhaseLabel,
} from '@/components/backtests/BacktestRunProgress'
import type { BacktestRequest } from '@/types/backtesting'

const request: BacktestRequest = {
  symbol: 'WSP$',
  timeframe: 'H1',
  strategy: 'MACrossover',
} as BacktestRequest

const STARTED_AT = '2026-10-12T07:14:21Z'

function status(overrides: Partial<BacktestStatusResponse> = {}): BacktestStatusResponse {
  return {
    run_id: 'run-1',
    status: 'running',
    error: null,
    phase: 'simulating',
    progress: 0.4,
    message: 'Replaying ticks · 2023-03-22',
    started_at: STARTED_AT,
    updated_at: '2026-10-12T07:15:00Z',
    simulated_until: '2023-03-22T10:00:00',
    bars_total: 1000,
    candles_replayed: 400,
    candles_substituted: 3,
    ...overrides,
  }
}

function renderProgress(value: BacktestStatusResponse | undefined) {
  return render(<BacktestRunProgress status={value} request={request} />)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-12T07:15:30Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BacktestRunProgress', () => {
  it('names the phase, marks the current step and shows the replay counters', () => {
    renderProgress(status())

    const stepper = screen.getByRole('list', { name: 'Backtest phases' })
    expect(within(stepper).getByText('Simulating')).toHaveAttribute('aria-current', 'step')
    expect(within(stepper).getByText('Loading data')).toHaveAttribute('data-state', 'done')
    expect(within(stepper).getByText('Saving')).toHaveAttribute('data-state', 'pending')
    expect(screen.getByText('Backtest running')).toBeInTheDocument()
    expect(screen.getByText('MACrossover · WSP$ · H1')).toBeInTheDocument()
    expect(screen.getByText('Replaying ticks · 2023-03-22')).toBeInTheDocument()
    expect(
      screen.getByText('Simulated to 2023-03-22 · 400 candles replayed · 3 substituted'),
    ).toBeInTheDocument()
  })

  it('draws a determinate bar with its percentage when progress is a number', () => {
    renderProgress(status({ progress: 0.4 }))

    const bar = screen.getByRole('progressbar', { name: 'Backtest progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '40')
    expect(screen.getByText(/40% · Elapsed/)).toBeInTheDocument()
  })

  it('draws an indeterminate bar without aria-valuenow when progress is null', () => {
    renderProgress(
      status({ phase: 'loading_data', progress: null, message: 'Loading H1 candles for WSP$' }),
    )

    const bar = screen.getByRole('progressbar', { name: 'Backtest progress' })
    expect(bar).not.toHaveAttribute('aria-valuenow')
    expect(screen.getByText('Loading H1 candles for WSP$')).toBeInTheDocument()
  })

  it('shows no replay counters when no candle has been replayed', () => {
    renderProgress(
      status({ phase: 'preparing', progress: null, candles_replayed: 0, candles_substituted: 0 }),
    )

    expect(screen.queryByText(/candles replayed/)).not.toBeInTheDocument()
  })

  it('renders a status without the new fields as the indeterminate running state', () => {
    renderProgress({ run_id: 'run-1', status: 'running', error: null })

    expect(screen.queryByRole('list', { name: 'Backtest phases' })).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    expect(screen.getByText('Running…')).toBeInTheDocument()
    expect(backtestPhaseLabel({ run_id: 'run-1', status: 'running', error: null })).toBe(
      'Simulating…',
    )
  })

  it('shows the stall line after the threshold without a changed update, and clears it on the next change', () => {
    const { rerender } = renderProgress(status({ phase: 'loading_data', progress: null }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(STALL_AFTER_MS + 1000)
    })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Waiting for market data · no update for 11 s',
    )

    rerender(
      <BacktestRunProgress
        status={status({
          phase: 'loading_data',
          progress: null,
          updated_at: '2026-10-12T07:15:41Z',
        })}
        request={request}
      />,
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('never shows the stall line in the other phases', () => {
    renderProgress(status({ phase: 'saving', progress: null }))

    act(() => {
      vi.advanceTimersByTime(STALL_AFTER_MS * 3)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('updates the elapsed time every second', () => {
    renderProgress(status({ progress: null, phase: 'preparing' }))
    expect(screen.getByText(/Elapsed 1m 9s/)).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText(/Elapsed 1m 11s/)).toBeInTheDocument()
  })

  it('labels the teaser with the phase and percentage', () => {
    expect(backtestPhaseLabel(status({ phase: 'simulating', progress: 0.4 }))).toBe(
      'Simulating · 40%',
    )
    expect(backtestPhaseLabel(status({ phase: 'saving', progress: null }))).toBe('Saving')
    expect(backtestPhaseLabel(undefined)).toBe('Simulating…')
  })
})
