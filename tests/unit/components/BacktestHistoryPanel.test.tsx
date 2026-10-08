import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { BacktestHistoryPanel } from '@/components/backtests/BacktestHistoryPanel'
import { handlers, resetMockBacktestDeletes } from '@/mocks/handlers'
import { useAppStore } from '@/store/useAppStore'
import { renderWithQueryClient } from '../testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockBacktestDeletes()
})
afterAll(() => server.close())

beforeEach(() => {
  useAppStore.getState().setPendingBacktestConfig(null)
})

describe('BacktestHistoryPanel', () => {
  it('shows saved tab and bulk delete flow', async () => {
    const user = userEvent.setup()
    const onSelectRun = vi.fn()
    const onReRun = vi.fn()

    renderWithQueryClient(
      <BacktestHistoryPanel selectedRunId={null} onSelectRun={onSelectRun} onReRun={onReRun} />,
    )

    await waitFor(() => {
      expect(screen.getByText(/Past Runs/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Saved' }))
    await waitFor(() => {
      expect(screen.getByText('1 saved')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Select' }))
    const checkboxes = await screen.findAllByRole('checkbox')
    await user.click(checkboxes[0]!)
    await user.click(screen.getByRole('button', { name: /Delete \(1\)/i }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })
  })

  it('renders TICK timeframe label for tick engine runs', async () => {
    renderWithQueryClient(
      <BacktestHistoryPanel selectedRunId={null} onSelectRun={vi.fn()} onReRun={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByText(/WIN\$ · TickMaBreakout/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/TICK ·/)).toBeInTheDocument()
  })

  it('enables compare at two selections', async () => {
    const user = userEvent.setup()

    renderWithQueryClient(
      <BacktestHistoryPanel
        selectedRunId={null}
        onSelectRun={vi.fn()}
        onReRun={vi.fn()}
        onCompare={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Select' }))

    expect(screen.getByRole('button', { name: /Compare \(0\)/i })).toBeDisabled()

    const checkboxes = await screen.findAllByRole('checkbox')
    await user.click(checkboxes[0]!)
    expect(screen.getByRole('button', { name: /Compare \(1\)/i })).toBeDisabled()

    await user.click(checkboxes[1]!)
    expect(screen.getByRole('button', { name: /Compare \(2\)/i })).toBeEnabled()
    expect(screen.getByText(/Select 2–5 runs to compare/i)).toBeInTheDocument()
  })

  it('restores an ML filter run with its exact version and threshold', async () => {
    renderWithQueryClient(
      <BacktestHistoryPanel selectedRunId="run-win-ml" onSelectRun={vi.fn()} onReRun={vi.fn()} />,
    )

    const summary = await screen.findByTestId('ml-filter-summary')
    expect(summary).toHaveTextContent('mlf-model-lightgbm-seed')
    expect(summary).toHaveTextContent('threshold 0.60')
    await waitFor(() => {
      expect(useAppStore.getState().pendingBacktestConfig?.ml_filter).toEqual({
        model_version_id: 'mlf-model-lightgbm-seed',
        threshold: 0.6,
      })
    })
  })

  it('marks script runs and filters the list by origin', async () => {
    const user = userEvent.setup()

    renderWithQueryClient(
      <BacktestHistoryPanel selectedRunId={null} onSelectRun={vi.fn()} onReRun={vi.fn()} />,
    )

    await screen.findByText('WDO$ · MACrossover')
    expect(screen.getAllByTestId('script-badge').length).toBeGreaterThan(0)

    await user.selectOptions(screen.getByLabelText('Filter by origin'), 'script')

    await waitFor(() => {
      expect(screen.queryByText('WIN$ · MACrossover')).not.toBeInTheDocument()
    })
    expect(screen.getByText('WDO$ · MACrossover')).toBeInTheDocument()
  })

  it('shows script provenance without a re-run action or loading its config', async () => {
    const onReRun = vi.fn()

    renderWithQueryClient(
      <BacktestHistoryPanel
        selectedRunId="run-script-ma"
        onSelectRun={vi.fn()}
        onReRun={onReRun}
        onOpenResults={vi.fn()}
      />,
    )

    expect(await screen.findByText('research/scripts/wdo_ma_crossover.py')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open results' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Re-run simulation/i })).not.toBeInTheDocument()
    expect(useAppStore.getState().pendingBacktestConfig).toBeNull()
    expect(onReRun).not.toHaveBeenCalled()
  })

  it('opens a stack run and keeps its re-run action', async () => {
    const user = userEvent.setup()
    const onOpenResults = vi.fn()

    renderWithQueryClient(
      <BacktestHistoryPanel
        selectedRunId="run-win-ma"
        onSelectRun={vi.fn()}
        onReRun={vi.fn()}
        onOpenResults={onOpenResults}
      />,
    )

    await user.click(await screen.findByRole('button', { name: 'Open results' }))

    expect(onOpenResults).toHaveBeenCalledWith('run-win-ma')
    expect(screen.getByRole('button', { name: /Re-run simulation/i })).toBeInTheDocument()
  })

  it('refuses Open results while a simulation is pending', async () => {
    renderWithQueryClient(
      <BacktestHistoryPanel
        selectedRunId="run-win-ma"
        onSelectRun={vi.fn()}
        onReRun={vi.fn()}
        onOpenResults={vi.fn()}
        simulationPending
      />,
    )

    expect(await screen.findByRole('button', { name: 'Open results' })).toBeDisabled()
    expect(screen.getByText(/A simulation is running/i)).toBeInTheDocument()
  })
})
