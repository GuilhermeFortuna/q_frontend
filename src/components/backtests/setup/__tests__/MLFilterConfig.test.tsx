import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { BacktestSetupPanel } from '@/components/backtests/setup/BacktestSetupPanel'
import { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { handlers } from '@/mocks/handlers'
import {
  MOCK_ML_INCOMPATIBLE_MODEL_ID,
  MOCK_ML_READY_MODEL_ID,
  resetMockMlFilterState,
} from '@/mocks/mlFilters'
import { useAppStore } from '@/store/useAppStore'
import type { BacktestRequest } from '@/types/backtesting'
import { renderWithQueryClient } from '../../../../../tests/unit/testUtils'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetMockMlFilterState())
afterEach(() => {
  server.resetHandlers()
  useAppStore.setState({ pendingBacktestConfig: null })
})
afterAll(() => server.close())

const MA_PARAMS = { short_period: 20, long_period: 80, threshold: 0.5 }

function restoreConfig(overrides: Partial<BacktestRequest> = {}): BacktestRequest {
  return {
    symbol: 'WIN$',
    timeframe: 'M5',
    start: '2026-03-18T03:00:00.000Z',
    end: '2026-05-04T03:00:00.000Z',
    initial_capital: 100000,
    point_value: 0.2,
    strategy: 'MACrossoverMLFilter',
    strategy_params: MA_PARAMS,
    entries: [{ strategy: 'MACrossoverMLFilter', params: MA_PARAMS }],
    entry_manager: { kind: 'or', params: {} },
    position_sizing: { type: 'fixed_quantity', quantity: 2 },
    ml_filter: { model_version_id: MOCK_ML_READY_MODEL_ID, threshold: 0.6 },
    ...overrides,
  }
}

function Harness({ onSubmit }: { onSubmit: (request: BacktestRequest) => void }) {
  const config = useBacktestConfig()
  return <BacktestSetupPanel config={config} loading={false} error={null} onSubmit={onSubmit} />
}

async function renderPanel(pending: BacktestRequest | null) {
  useAppStore.setState({ pendingBacktestConfig: pending })
  const onSubmit = vi.fn()
  renderWithQueryClient(<Harness onSubmit={onSubmit} />)
  return onSubmit
}

describe('MLFilterConfig', () => {
  it('is absent for the original strategy form', async () => {
    await renderPanel(null)
    await screen.findByTestId('strategy-studio')
    expect(screen.queryByTestId('ml-filter-config')).not.toBeInTheDocument()
  })

  it('shows a labelled model selector and threshold editor apart from MA parameters', async () => {
    await renderPanel(restoreConfig())
    const config = await screen.findByTestId('ml-filter-config')
    expect(within(config).getByLabelText('Model version')).toBeInTheDocument()
    expect(within(config).getByLabelText('Acceptance threshold')).toHaveValue(0.6)
    expect(config).toHaveTextContent(/opposite crossover still closes/i)

    const select = within(config).getByLabelText('Model version') as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe(MOCK_ML_READY_MODEL_ID))
    const options = within(select).getAllByRole('option')
    expect(
      options.some((option) =>
        /LightGBM · trained through 2026\/03\/18 00:00/.test(option.textContent ?? ''),
      ),
    ).toBe(true)
    const incompatible = options.find((option) => option.textContent?.includes('(incompatible)'))
    expect(incompatible).toBeDisabled()
    expect(
      within(config).getByRole('list', { name: 'Incompatible model versions' }),
    ).toHaveTextContent('checksum does not match')
  })

  it('submits the exact saved version and threshold', async () => {
    const user = userEvent.setup()
    const onSubmit = await renderPanel(restoreConfig())
    const button = await screen.findByTestId('run-simulation-button')
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      strategy: 'MACrossoverMLFilter',
      ml_filter: { model_version_id: MOCK_ML_READY_MODEL_ID, threshold: 0.6 },
    })
  })

  it('edits the threshold within 0..1 and blocks values outside the range', async () => {
    await renderPanel(restoreConfig())
    const input = await screen.findByLabelText('Acceptance threshold')
    fireEvent.change(input, { target: { value: '1.4' } })
    fireEvent.blur(input)
    expect(await screen.findAllByText('Threshold must be between 0 and 1.')).not.toHaveLength(0)
    expect(screen.getByTestId('run-simulation-button')).toBeDisabled()
  })

  it('keeps a missing model visible and blocks the run', async () => {
    await renderPanel(
      restoreConfig({ ml_filter: { model_version_id: 'mlf-gone', threshold: 0.5 } }),
    )
    const select = (await screen.findByLabelText('Model version')) as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe('mlf-gone'))
    expect(await screen.findByRole('alert')).toHaveTextContent(/mlf-gone was not found/)
    expect(screen.getByTestId('run-simulation-button')).toBeDisabled()
  })

  it('explains an incompatible selection and does not substitute another model', async () => {
    await renderPanel(
      restoreConfig({
        ml_filter: { model_version_id: MOCK_ML_INCOMPATIBLE_MODEL_ID, threshold: 0.5 },
      }),
    )
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/checksum/))
    const select = screen.getByLabelText('Model version') as HTMLSelectElement
    expect(select.value).toBe(MOCK_ML_INCOMPATIBLE_MODEL_ID)
    expect(screen.getByTestId('run-simulation-button')).toBeDisabled()
  })

  it('selecting a version loads its baseline values into the form', async () => {
    const user = userEvent.setup()
    await renderPanel(restoreConfig({ ml_filter: null, symbol: 'PETR4', timeframe: 'D1' }))
    const select = (await screen.findByLabelText('Model version')) as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe(''))
    await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1))
    await user.selectOptions(select, MOCK_ML_READY_MODEL_ID)
    await waitFor(() => expect(select.value).toBe(MOCK_ML_READY_MODEL_ID))
    await waitFor(() =>
      expect(screen.getByTestId('ml-filter-selected-summary')).toBeInTheDocument(),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('hides extra-entry controls for the variant but exposes the manager to fix a bad restore', async () => {
    await renderPanel(restoreConfig())
    await screen.findByTestId('ml-filter-config')
    expect(screen.queryByText('Entry manager')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add .*entry/i })).not.toBeInTheDocument()
  })

  it('shows the composition error and the manager for a restored multi-entry config', async () => {
    await renderPanel(
      restoreConfig({
        entries: [
          { strategy: 'MACrossoverMLFilter', params: MA_PARAMS },
          { strategy: 'MACrossoverMLFilter', params: MA_PARAMS },
        ],
        entry_manager: { kind: 'and', params: {} },
      }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(/exactly one candle entry/)
    expect(screen.getByTestId('run-simulation-button')).toBeDisabled()
  })
})
