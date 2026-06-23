import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { StrategyStudio } from '@/components/backtests/setup/StrategyStudio'
import { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { useAiStrategySession } from '@/lib/strategies/useAiStrategySession'
import { handlers } from '@/mocks/handlers'
import { mockStrategies, mockCustomStrategies, resetMockCustomStrategies } from '@/mocks/data'
import {
  buildInterpretResponse,
  COMPILED_EMA_CROSS,
  EMA_CROSS_SPEC,
  MOCK_CAPABILITIES,
  TIMEFRAME_VALIDATION_ERROR,
} from '../fixtures/strategyBuilderFixtures'
import { renderWithQueryClient } from '../testUtils'
import { mockExitCatalog, mockExitParamSpecs } from '../workspaces/exitConfiguratorFixtures'
import type { CustomStrategy, StrategiesResponse } from '@/types/strategies'
import { downloadStrategySpecJson } from '@/lib/strategies/exportStrategySpec'

vi.mock('@/lib/strategies/exportStrategySpec', () => ({
  downloadStrategySpecJson: vi.fn(),
}))

const server = setupServer(...handlers)

const studioStrategyResponse: StrategiesResponse = {
  strategies: [
    {
      name: 'CompositeStrategy',
      label: 'Composite Strategy',
      description: 'Composite genome strategy.',
      thesis: 'Composable genome strategy.',
      params: [
        {
          name: 'exit_stop_loss_pct',
          label: 'Stop Loss %',
          type: 'float',
          default: 0,
          min: 0,
          max: 50,
          step: 0.1,
          exit_group: 'stop_loss',
          hint: 'Fixed stop loss percent.',
        },
        ...mockExitParamSpecs,
      ],
    },
    ...mockStrategies.strategies.filter((entry) => entry.name !== 'CompositeStrategy'),
  ],
}

let interpretRequestBody: Record<string, unknown> | null = null
let saveCustomRequestBody: CustomStrategy | null = null

function StrategyStudioHarness({
  onRunBacktest = vi.fn(),
}: {
  onRunBacktest?: ReturnType<typeof vi.fn>
}) {
  const config = useBacktestConfig()
  const aiSession = useAiStrategySession({ config, onRunBacktest })
  return (
    <>
      <StrategyStudio config={config} aiSession={aiSession} />
      <div data-testid="applied-strategy">{config.fields.strategy}</div>
      <div data-testid="applied-symbol">{config.fields.symbol}</div>
      <div data-testid="applied-timeframe">{config.fields.timeframe}</div>
    </>
  )
}

async function interpretAndApply(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId('ai-strategy-message'), 'Create EMA crossover')
  await user.click(screen.getByTestId('ai-strategy-submit'))
  await waitFor(() => {
    expect(screen.getByTestId('ai-strategy-apply')).toBeInTheDocument()
  })
  await user.click(screen.getByTestId('ai-strategy-apply'))
  await waitFor(() => {
    expect(screen.getByTestId('applied-strategy')).toHaveTextContent('CompositeStrategy')
  })
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetMockCustomStrategies()
  interpretRequestBody = null
  saveCustomRequestBody = null
  vi.mocked(downloadStrategySpecJson).mockClear()
  server.use(
    http.get('*/api/v1/strategies', () => HttpResponse.json(studioStrategyResponse)),
    http.get('*/api/v1/exit-rules', () => HttpResponse.json(mockExitCatalog)),
    http.get('*/api/v1/strategy-builder/capabilities', () => HttpResponse.json(MOCK_CAPABILITIES)),
    http.post('*/api/v1/strategy-builder/interpret', async ({ request }) => {
      interpretRequestBody = (await request.json()) as Record<string, unknown>
      return HttpResponse.json(buildInterpretResponse())
    }),
    http.post('*/api/v1/strategies/custom', async ({ request }) => {
      saveCustomRequestBody = (await request.json()) as CustomStrategy
      const body = saveCustomRequestBody
      const existingIndex = mockCustomStrategies.findIndex((entry) => entry.name === body.name)
      if (existingIndex >= 0) {
        mockCustomStrategies[existingIndex] = body
      } else {
        mockCustomStrategies.push(body)
      }
      return HttpResponse.json(body)
    }),
  )
})
afterEach(() => {
  server.resetHandlers()
  resetMockCustomStrategies()
  vi.restoreAllMocks()
})
afterAll(() => server.close())

async function waitForStudioReady() {
  await waitFor(() => {
    expect(screen.getByTestId('strategy-studio')).toBeInTheDocument()
    expect(screen.getByTestId('ai-strategy-panel')).toBeInTheDocument()
  })
}

describe('AiStrategyPanel in StrategyStudio', () => {
  it('renders the AI panel inside StrategyStudio', async () => {
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForStudioReady()

    expect(screen.getByTestId('ai-strategy-message')).toBeInTheDocument()
    expect(screen.getByTestId('ai-strategy-submit')).toBeInTheDocument()
  })

  it('submits a prompt to the interpret endpoint', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForStudioReady()

    await user.type(
      screen.getByTestId('ai-strategy-message'),
      'Create a trend strategy using EMA 20 and EMA 50.',
    )
    await user.click(screen.getByTestId('ai-strategy-submit'))

    await waitFor(() => {
      expect(interpretRequestBody).not.toBeNull()
    })
    expect(interpretRequestBody).toMatchObject({
      message: 'Create a trend strategy using EMA 20 and EMA 50.',
      capabilities_version: 'q_capabilities.v1',
    })
    expect(screen.getByTestId('ai-strategy-results')).toBeInTheDocument()
  })

  it('renders assumptions and unsupported requests', async () => {
    server.use(
      http.post('*/api/v1/strategy-builder/interpret', () =>
        HttpResponse.json(
          buildInterpretResponse({
            unsupported_requests: ['Supertrend indicator', 'Live trading'],
            assumptions: ['Uses daily bars only.'],
          }),
        ),
      ),
    )

    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForStudioReady()

    await user.type(screen.getByTestId('ai-strategy-message'), 'Build supertrend for live trading')
    await user.click(screen.getByTestId('ai-strategy-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('ai-strategy-assumptions')).toBeInTheDocument()
      expect(screen.getByTestId('ai-strategy-unsupported')).toBeInTheDocument()
    })

    const assumptions = within(screen.getByTestId('ai-strategy-assumptions'))
    expect(assumptions.getByText('Uses daily bars only.')).toBeInTheDocument()

    const unsupported = within(screen.getByTestId('ai-strategy-unsupported'))
    expect(unsupported.getByText('Supertrend indicator')).toBeInTheDocument()
    expect(unsupported.getByText('Live trading')).toBeInTheDocument()
  })

  it('renders validation errors with path, code, and message', async () => {
    server.use(
      http.post('*/api/v1/strategy-builder/interpret', () =>
        HttpResponse.json(
          buildInterpretResponse({
            strategy_spec: { ...EMA_CROSS_SPEC, timeframe: 'BADTF' },
            validation: { valid: false, errors: [TIMEFRAME_VALIDATION_ERROR] },
            compiled_strategy: null,
          }),
        ),
      ),
    )

    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForStudioReady()

    await user.type(screen.getByTestId('ai-strategy-message'), 'Use an invalid timeframe')
    await user.click(screen.getByTestId('ai-strategy-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('ai-strategy-validation-errors')).toBeInTheDocument()
    })

    expect(screen.getByText(/timeframe · unsupported_timeframe/i)).toBeInTheDocument()
    expect(screen.getByText("Timeframe 'BADTF' is not currently supported.")).toBeInTheDocument()
  })

  it('Ask AI to fix resubmits with validation errors', async () => {
    let interpretCalls = 0
    server.use(
      http.post('*/api/v1/strategy-builder/interpret', async ({ request }) => {
        interpretCalls += 1
        interpretRequestBody = (await request.json()) as Record<string, unknown>
        if (interpretCalls === 1) {
          return HttpResponse.json(
            buildInterpretResponse({
              strategy_spec: { ...EMA_CROSS_SPEC, timeframe: 'BADTF' },
              validation: { valid: false, errors: [TIMEFRAME_VALIDATION_ERROR] },
              compiled_strategy: null,
            }),
          )
        }
        return HttpResponse.json(buildInterpretResponse())
      }),
    )

    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForStudioReady()

    await user.type(screen.getByTestId('ai-strategy-message'), 'Use an invalid timeframe')
    await user.click(screen.getByTestId('ai-strategy-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('ai-strategy-ask-fix')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('ai-strategy-ask-fix'))

    await waitFor(() => {
      expect(interpretCalls).toBe(2)
    })
    expect(interpretRequestBody).toMatchObject({
      validation_errors: [TIMEFRAME_VALIDATION_ERROR],
    })
    expect(screen.getByTestId('ai-strategy-apply')).toBeInTheDocument()
  })

  it('Apply to setup updates strategy and params from compiled payload', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForStudioReady()

    await user.type(screen.getByTestId('ai-strategy-message'), 'Create EMA crossover')
    await user.click(screen.getByTestId('ai-strategy-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('ai-strategy-apply')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('ai-strategy-apply'))

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toHaveValue(COMPILED_EMA_CROSS.summary.name)
      expect(screen.getByTestId('applied-strategy')).toHaveTextContent('CompositeStrategy')
      expect(screen.getByTestId('applied-symbol')).toHaveTextContent('PETR4')
      expect(screen.getByTestId('applied-timeframe')).toHaveTextContent('D1')
    })
  })

  it('renders a non-crashing error state when AI service is unavailable', async () => {
    server.use(
      http.post('*/api/v1/strategy-builder/interpret', () =>
        HttpResponse.json(
          {
            detail: {
              status: 'ai_disabled',
              message: 'AI strategy interpretation is disabled.',
            },
          },
          { status: 503 },
        ),
      ),
    )

    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForStudioReady()

    await user.type(screen.getByTestId('ai-strategy-message'), 'Create a strategy')
    await user.click(screen.getByTestId('ai-strategy-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('ai-strategy-service-error')).toBeInTheDocument()
    })
    expect(screen.getByText(/AI strategy interpretation is disabled/i)).toBeInTheDocument()
    expect(screen.getByTestId('strategy-studio')).toBeInTheDocument()
  })
})

describe('AiStrategyPanel WO95 workflow', () => {
  it('save payload includes AI metadata after apply', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForStudioReady()
    await interpretAndApply(user)

    const nameInput = screen.getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'My AI EMA Strategy')

    await user.click(screen.getByTestId('ai-strategy-save'))

    await waitFor(() => {
      expect(saveCustomRequestBody).not.toBeNull()
    })
    expect(saveCustomRequestBody).toMatchObject({
      name: 'My AI EMA Strategy',
      base_strategy: 'CompositeStrategy',
      ai_metadata: {
        strategy_spec: EMA_CROSS_SPEC,
        strategy_spec_version: 'strategy_spec.v1',
        capabilities_version: 'q_capabilities.v1',
        original_prompt: 'Create EMA crossover',
        compiled_strategy_id: COMPILED_EMA_CROSS.compiled_id,
        compiled_strategy: COMPILED_EMA_CROSS,
      },
    })
    expect(saveCustomRequestBody?.ai_metadata?.assumptions.length).toBeGreaterThan(0)
  })

  it('unsupported requests block save and run until acknowledged', async () => {
    server.use(
      http.post('*/api/v1/strategy-builder/interpret', () =>
        HttpResponse.json(
          buildInterpretResponse({
            unsupported_requests: ['Supertrend indicator'],
          }),
        ),
      ),
    )

    const onRunBacktest = vi.fn()
    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness onRunBacktest={onRunBacktest} />)
    await waitForStudioReady()
    await interpretAndApply(user)

    expect(screen.getByTestId('ai-strategy-save')).toBeDisabled()
    expect(screen.getByTestId('ai-strategy-run')).toBeDisabled()
    expect(screen.getByTestId('ai-strategy-workflow-blocker')).toHaveTextContent(
      /acknowledge unsupported requests/i,
    )

    await user.click(
      within(screen.getByTestId('ai-strategy-unsupported-ack')).getByRole('checkbox'),
    )
    expect(screen.getByTestId('ai-strategy-save')).not.toBeDisabled()

    await user.click(screen.getByTestId('ai-strategy-run'))
    expect(onRunBacktest).toHaveBeenCalledTimes(1)
    expect(onRunBacktest.mock.calls[0][0].strategy).toBe('CompositeStrategy')
  })

  it('run backtest uses the applied compiled config', async () => {
    const onRunBacktest = vi.fn()
    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness onRunBacktest={onRunBacktest} />)
    await waitForStudioReady()
    await interpretAndApply(user)

    await user.click(screen.getByTestId('ai-strategy-run'))

    expect(onRunBacktest).toHaveBeenCalledTimes(1)
    const payload = onRunBacktest.mock.calls[0][0]
    expect(payload.strategy).toBe('CompositeStrategy')
    expect(payload.symbol).toBe('PETR4')
    expect(payload.timeframe).toBe('D1')
    expect(payload.strategy_params.exit_stop_loss_pct).toBe(0.03)
  })

  it('duplicate preserves spec metadata but creates an editable draft', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForStudioReady()
    await interpretAndApply(user)

    await user.click(screen.getByTestId('ai-strategy-duplicate'))

    expect(screen.getByLabelText('Name')).toHaveValue('EMA Trend Cross Copy')
    expect(screen.getByTestId('ai-strategy-preview')).toBeInTheDocument()
    expect(screen.getByTestId('ai-strategy-save')).toBeDisabled()
    expect(screen.getByTestId('ai-strategy-workflow-blocker')).toHaveTextContent(
      /apply the compiled draft/i,
    )
  })

  it('export downloads strategy_spec.v1 JSON', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForStudioReady()
    await interpretAndApply(user)

    await user.click(screen.getByTestId('ai-strategy-export'))

    expect(downloadStrategySpecJson).toHaveBeenCalledWith(
      expect.objectContaining({
        schema_version: 'strategy_spec.v1',
        name: EMA_CROSS_SPEC.name,
      }),
    )
  })
})
