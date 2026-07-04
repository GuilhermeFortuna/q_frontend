import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { StrategyStudio } from '@/components/backtests/setup/StrategyStudio'
import { AiStrategyPanel } from '@/components/backtests/setup/AiStrategyPanel'
import { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { Callout } from '@/components/ui'
import { useAiStrategySession } from '@/lib/strategies/useAiStrategySession'
import { handlers } from '@/mocks/handlers'
import { mockStrategies, mockCustomStrategies, resetMockCustomStrategies } from '@/mocks/data'
import {
  buildInterpretResponse,
  COMPILED_EMA_CROSS,
  EMA_CROSS_SPEC,
  MOCK_CAPABILITIES,
  MOCK_MODELS,
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
  const { authoring } = config
  return (
    <>
      {/* Strategy Customizer Header rendered in test harness */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label htmlFor="studio-strategy-name">Name</label>
            <input
              id="studio-strategy-name"
              type="text"
              value={authoring.customName}
              onChange={(event) => authoring.setCustomName(event.target.value)}
              placeholder="e.g. MyRSIReversion"
              disabled={Boolean(authoring.loadedCustomName)}
            />
          </div>

          <div className="min-w-[16rem] flex-[2] space-y-1">
            <label htmlFor="studio-strategy-desc">Description</label>
            <input
              id="studio-strategy-desc"
              type="text"
              value={authoring.description}
              onChange={(event) => authoring.setDescription(event.target.value)}
              placeholder="Optional thesis summary..."
            />
          </div>

          <div className="flex shrink-0 items-center gap-2 pb-0.5">
            <button type="button" onClick={authoring.newDraft}>
              New
            </button>
            <button
              type="button"
              onClick={authoring.saveCustom}
              disabled={authoring.isSaving || authoring.customName.trim().length === 0}
            >
              {authoring.isSaving ? 'Saving…' : 'Save'}
            </button>
            {authoring.loadedCustomName ? (
              <button
                type="button"
                onClick={() => authoring.deleteCustom(authoring.loadedCustomName!)}
                title="Delete loaded custom strategy"
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>

        {authoring.authoringError ? (
          <Callout type="error" title="Strategy Code Error" className="mb-2">
            {authoring.authoringError}
          </Callout>
        ) : null}
      </div>

      <StrategyStudio config={config} />
      <AiStrategyPanel session={aiSession} />
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
    http.get('*/api/v1/strategy-builder/models', () => HttpResponse.json(MOCK_MODELS)),
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
      model: 'test-model-a',
      capabilities_version: 'q_capabilities.v1',
    })
    expect(screen.getByTestId('ai-strategy-results')).toBeInTheDocument()
  })

  it('renders the local model dropdown and sends the selected model', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForStudioReady()

    const modelSelect = await screen.findByTestId('ai-strategy-model')
    expect(modelSelect).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Model A' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Model B (not loaded)' })).toBeInTheDocument()

    await user.selectOptions(modelSelect, 'test-model-b')
    await user.type(screen.getByTestId('ai-strategy-message'), 'Create EMA crossover')
    await user.click(screen.getByTestId('ai-strategy-submit'))

    await waitFor(() => {
      expect(interpretRequestBody).toMatchObject({
        model: 'test-model-b',
      })
    })
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
    expect(screen.getByTestId('ai-strategy-service-error')).toHaveTextContent(
      /AI strategy interpretation is disabled/i,
    )
    expect(screen.getByTestId('ai-chat-notice-turn')).toHaveTextContent(
      /AI strategy interpretation is disabled/i,
    )
    expect(screen.getByTestId('strategy-studio')).toBeInTheDocument()
  })

  it('renders the Gemini provider-specific key hint when no models are configured', async () => {
    server.use(
      http.get('*/api/v1/strategy-builder/models', () =>
        HttpResponse.json({
          provider: 'gemini',
          default_model: '',
          models: [],
        }),
      ),
    )

    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForStudioReady()

    const hint = await screen.findByTestId('ai-strategy-models-hint')
    expect(hint).toHaveTextContent('Check your Gemini API key.')
  })

  it('renders the default provider-specific hint when no models are configured', async () => {
    server.use(
      http.get('*/api/v1/strategy-builder/models', () =>
        HttpResponse.json({
          provider: 'openai_compatible',
          default_model: '',
          models: [],
        }),
      ),
    )

    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForStudioReady()

    const hint = await screen.findByTestId('ai-strategy-models-hint')
    expect(hint).toHaveTextContent('Start the Ollama server (and pull a model) to enable models.')
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
