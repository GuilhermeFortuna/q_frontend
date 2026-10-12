import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BacktestRunProgress,
  STALL_AFTER_MS,
  backtestPhaseLabel,
} from '@/components/backtests/BacktestRunProgress'
import type { BacktestStatusResponse } from '../../../../contracts/api'
import type { BacktestLiveStatus } from '@/lib/backtesting/backtestProgress'
import type { BacktestRequest } from '@/types/backtesting'

const request = { symbol: 'WSP$', timeframe: 'H1', strategy: 'MACrossover' } as BacktestRequest
const STARTED_AT = '2026-10-12T07:14:21Z'
function status(overrides: Partial<BacktestStatusResponse> = {}): BacktestStatusResponse {
  return {
    run_id: 'run-1',
    status: 'running',
    phase: 'simulating',
    progress: 0.4,
    message: 'Replaying ticks · 2023-03-22',
    started_at: STARTED_AT,
    updated_at: '2026-10-12T07:15:00Z',
    simulated_until: '2023-03-22T10:00:00',
    bars_total: 1000,
    candles_replayed: 12,
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
  it('keeps replay details behind a keyboard-accessible disclosure', () => {
    renderProgress(status())
    const stepper = screen.getByRole('list', { name: 'Backtest phases' })
    expect(within(stepper).getByText('Simulating')).toHaveAttribute('aria-current', 'step')
    expect(within(stepper).getByText('Loading data')).toHaveAttribute('data-state', 'done')
    const disclosure = screen.getByRole('button', { name: /Run details/ })
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('12')).not.toBeInTheDocument()
    fireEvent.click(disclosure)
    expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Completed replays')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
  it('labels a measured fraction as historical coverage, not overall completion', () => {
    renderProgress(status())
    expect(screen.getByRole('progressbar', { name: 'Historical range processed' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    )
    expect(screen.getByText('Historical range processed')).toBeInTheDocument()
    expect(screen.getByText(/not a time estimate/i)).toBeInTheDocument()
  })
  it('never draws a filled progress bar for unmeasured work', () => {
    renderProgress(
      status({ phase: 'loading_data', progress: null, message: 'Loading H1 candles for WSP$' }),
    )
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText('Loading H1 candles for WSP$')).toBeInTheDocument()
  })
  it('does not show a stale numeric fraction outside simulation', () => {
    renderProgress(status({ phase: 'saving', progress: 0.4 }))
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
  it('explains missing telemetry without guessing a phase or fraction', () => {
    renderProgress({ run_id: 'run-1', status: 'running' })
    expect(screen.getByText('Detailed progress unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Backtest phases' })).not.toBeInTheDocument()
    expect(backtestPhaseLabel({ run_id: 'run-1', status: 'running' })).toBe(
      'Detailed progress unavailable',
    )
  })
  it('reports silence honestly in every phase and clears it on the next update', () => {
    const { rerender } = renderProgress(status({ phase: 'saving', progress: null }))
    act(() => {
      vi.advanceTimersByTime(STALL_AFTER_MS + 1000)
    })
    expect(screen.getByRole('status')).toHaveTextContent('No new progress update for 11s')
    expect(screen.queryByText(/Waiting for market data/)).not.toBeInTheDocument()
    rerender(
      <BacktestRunProgress
        status={status({ phase: 'saving', progress: null, updated_at: '2026-10-12T07:15:41Z' })}
        request={request}
      />,
    )
    expect(screen.queryByText(/No new progress update/)).not.toBeInTheDocument()
  })
  it('shows the pending read duration and requested range', () => {
    renderProgress(
      status({
        activity: {
          kind: 'reading_ticks',
          started_at: '2026-10-12T07:15:00Z',
          range_start: '2023-03-22T10:00:00',
          range_end: '2023-03-22T11:00:00',
        },
      }),
    )
    expect(screen.getByRole('heading', { name: 'Reading trade ticks' })).toBeInTheDocument()
    expect(screen.getByText('Read in progress · 30s')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Run details/ }))
    expect(screen.getByText(/2023-03-22 10:00.*2023-03-22 11:00/)).toBeInTheDocument()
  })
  it('resets the disclosure and freshness when the run changes', () => {
    const { rerender } = renderProgress(status())
    fireEvent.click(screen.getByRole('button', { name: /Run details/ }))
    act(() => {
      vi.advanceTimersByTime(STALL_AFTER_MS + 1000)
    })
    rerender(
      <BacktestRunProgress
        status={status({ run_id: 'run-2', phase: 'queued', progress: null, candles_replayed: 0 })}
        request={request}
      />,
    )
    expect(screen.getByRole('button', { name: /Run details/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByText(/No new progress update/)).not.toBeInTheDocument()
  })
  it('qualifies retained activity and freezes its durations when telemetry is missing', () => {
    const value: BacktestLiveStatus = {
      ...status(),
      telemetryUnavailable: true,
      activity: { kind: 'reading_ticks', started_at: '2026-10-12T07:14:50Z' },
      phase_history: [{ phase: 'simulating', started_at: '2026-10-12T07:14:40Z' }],
    }
    renderProgress(value)
    expect(screen.getByText('Last reported read · 10s')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Run details/ }))
    expect(screen.getByText('20s · last reported')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(STALL_AFTER_MS + 1000)
    })
    expect(screen.getByText('Last reported read · 10s')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('no new progress update for 11s')
  })

  it('updates elapsed time every second', () => {
    renderProgress(status({ progress: null, phase: 'preparing' }))
    expect(screen.getByText('1m 9s')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('1m 11s')).toBeInTheDocument()
  })
  it('uses the activity and explicit coverage meaning in the teaser', () => {
    expect(backtestPhaseLabel(status())).toBe('Simulating · 40% of historical range')
    expect(backtestPhaseLabel(status({ phase: 'saving', progress: null }))).toBe('Saving')
    expect(backtestPhaseLabel(undefined)).toBe('Starting backtest…')
  })
  it('offers cancelling the run and disables the control while cancelling', () => {
    const onCancel = vi.fn()
    const { rerender } = render(
      <BacktestRunProgress status={status()} request={request} onCancel={onCancel} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Run' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    rerender(
      <BacktestRunProgress status={status()} request={request} onCancel={onCancel} cancelling />,
    )
    expect(screen.getByRole('button', { name: 'Cancelling…' })).toBeDisabled()
  })
  it('shows a cancel failure and hides the control when cancelling is unavailable', () => {
    const { rerender } = render(
      <BacktestRunProgress
        status={status()}
        request={request}
        onCancel={vi.fn()}
        cancelError="Backtest run not found."
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Backtest run not found.')
    rerender(<BacktestRunProgress status={status()} request={request} />)
    expect(screen.queryByRole('button', { name: 'Cancel Run' })).not.toBeInTheDocument()
  })
})
