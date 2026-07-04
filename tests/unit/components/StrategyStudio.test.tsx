import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { StrategyStudio } from '@/components/backtests/setup/StrategyStudio'
import { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { Callout } from '@/components/ui'
import { handlers } from '@/mocks/handlers'
import { mockStrategies, resetMockCustomStrategies } from '@/mocks/data'
import { renderWithQueryClient } from '../testUtils'
import { mockExitCatalog, mockExitParamSpecs } from '../workspaces/exitConfiguratorFixtures'
import { MOCK_CAPABILITIES, MOCK_MODELS } from '../fixtures/strategyBuilderFixtures'
import type { CustomStrategy, StrategiesResponse } from '@/types/strategies'

const server = setupServer(...handlers)

const studioStrategyResponse: StrategiesResponse = {
  strategies: [
    {
      name: 'StudioStrategy',
      label: 'Studio Strategy',
      description: 'Strategy used for StrategyStudio tests.',
      thesis: 'Entry thesis for studio testing.',
      params: [
        {
          name: 'entry_period',
          label: 'Entry Period',
          type: 'int',
          default: 20,
          min: 2,
          max: 100,
          step: 1,
          hint: 'Entry hint.',
        },
        ...mockExitParamSpecs,
      ],
    },
    ...mockStrategies.strategies.filter((entry) => entry.name !== 'CompositeStrategy'),
  ],
}

const savedCustom: CustomStrategy = {
  name: 'MySavedStudio',
  base_strategy: 'StudioStrategy',
  description: 'Saved studio strategy',
  parameters: {
    entry_period: 25,
    rule_a_enable: 2,
    rule_b_enable: 0,
    rule_a_offset: 0.05,
    rule_c_enable: 0,
    shared_indicator: 14,
  },
}

function useStudioCustomMocks(customs: CustomStrategy[] = [savedCustom]) {
  server.use(http.get('*/api/v1/strategies/custom', () => HttpResponse.json(customs)))
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetMockCustomStrategies()
  server.use(
    http.get('*/api/v1/strategies', () => HttpResponse.json(studioStrategyResponse)),
    http.get('*/api/v1/exit-rules', () => HttpResponse.json(mockExitCatalog)),
    http.get('*/api/v1/strategy-builder/capabilities', () => HttpResponse.json(MOCK_CAPABILITIES)),
    http.get('*/api/v1/strategy-builder/models', () => HttpResponse.json(MOCK_MODELS)),
  )
})
afterEach(() => {
  server.resetHandlers()
  resetMockCustomStrategies()
  vi.restoreAllMocks()
})
afterAll(() => server.close())

function StrategyStudioHarness({ hidden = false }: { hidden?: boolean }) {
  const config = useBacktestConfig()
  const { authoring } = config
  return (
    <div hidden={hidden} className="space-y-4">
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
    </div>
  )
}

async function waitForDefaultStrategy() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /MA Crossover/i, pressed: true })).toBeInTheDocument()
  })
}

describe('StrategyStudio', () => {
  it('renders entry cards and exit cards in one column without tabs', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForDefaultStrategy()

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Short Period' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Studio Strategy/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Exit Strategies' })).toBeInTheDocument()
      expect(screen.getByTestId('entry-manager-selector')).toBeInTheDocument()
      expect(screen.getByTestId('entry-instance-0')).toBeInTheDocument()
      expect(screen.getByTestId('entry-instance-1')).toBeInTheDocument()
    })
  })

  it('toggling an exit card on reveals value fields and toggling off hides them', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForDefaultStrategy()

    await user.click(screen.getByRole('button', { name: /Studio Strategy/i }))

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: 'Entry Period' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('spinbutton', { name: 'Rule A Offset' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Rule A/i }))

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: 'Rule A Offset' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /Rule A/i })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /Rule A/i }))

    await waitFor(() => {
      expect(screen.queryByRole('spinbutton', { name: 'Rule A Offset' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /Rule A/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('edits entry and enabled-exit params in the same flat strategyParams bag', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForDefaultStrategy()

    await user.click(screen.getByRole('button', { name: /Studio Strategy/i }))

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: 'Entry Period' })).toBeInTheDocument()
    })

    const entryPeriod = screen.getByRole('spinbutton', { name: 'Entry Period' })
    await user.clear(entryPeriod)
    await user.type(entryPeriod, '15')

    await user.click(screen.getByRole('button', { name: /Rule A/i }))
    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: 'Rule A Offset' })).toBeInTheDocument()
    })

    const ruleAOffset = screen.getByRole('spinbutton', { name: 'Rule A Offset' })
    await user.clear(ruleAOffset)
    await user.type(ruleAOffset, '0.05')

    expect(screen.getByRole('spinbutton', { name: 'Entry Period' })).toHaveValue(15)
    expect(screen.getByRole('spinbutton', { name: 'Rule A Offset' })).toHaveValue(0.05)
  })

  it('shows shared indicator settings only when an enabled rule requires them', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForDefaultStrategy()

    await user.click(screen.getByRole('button', { name: /Studio Strategy/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Exit Strategies' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('spinbutton', { name: 'Shared Indicator' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Rule B/i }))

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: 'Shared Indicator' })).toBeInTheDocument()
    })
  })

  it('posts save payload and rejects built-in name collisions', async () => {
    const user = userEvent.setup()
    let savedPayload: CustomStrategy | null = null

    server.use(
      http.post('*/api/v1/strategies/custom', async ({ request }) => {
        savedPayload = (await request.json()) as CustomStrategy
        return HttpResponse.json(savedPayload)
      }),
    )

    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForDefaultStrategy()

    await user.type(screen.getByLabelText('Name'), 'MACrossover')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText(/conflicts with a built-in strategy name/i)).toBeInTheDocument()
    expect(savedPayload).toBeNull()

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'MyStudioCustom')
    await user.type(screen.getByLabelText('Description'), 'Studio custom desc')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(savedPayload).not.toBeNull()
    })
    expect(savedPayload).toMatchObject({
      name: 'MyStudioCustom',
      base_strategy: 'MACrossover',
      description: 'Studio custom desc',
      parameters: expect.objectContaining({
        short_period: 50,
        long_period: 200,
      }),
    })
  })

  it('selecting two entry cards renders manager selector and per-instance sections', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForDefaultStrategy()

    await user.click(screen.getByRole('button', { name: /Studio Strategy/i }))

    await waitFor(() => {
      expect(screen.getByTestId('entry-manager-selector')).toBeInTheDocument()
      expect(screen.getByText(/e0 · MA Crossover/i)).toBeInTheDocument()
      expect(screen.getByText(/e1 · Studio Strategy/i)).toBeInTheDocument()
    })
  })

  it('clears the draft with New and resets after deleting the loaded custom', async () => {
    const user = userEvent.setup()
    useStudioCustomMocks()

    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForDefaultStrategy()

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Saved' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('radio', { name: 'Saved' }))
    await waitFor(() => {
      expect(screen.getByTestId(`custom-strategy-card-${savedCustom.name}`)).toBeInTheDocument()
    })
    await user.click(
      within(screen.getByTestId(`custom-strategy-card-${savedCustom.name}`)).getByRole('button', {
        name: new RegExp(`^${savedCustom.name} Custom`),
      }),
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toHaveValue(savedCustom.name)
    })

    await user.click(screen.getByRole('button', { name: 'New' }))

    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByLabelText('Description')).toHaveValue('')

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Saved' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('radio', { name: 'Saved' }))
    await waitFor(() => {
      expect(screen.getByTestId(`custom-strategy-card-${savedCustom.name}`)).toBeInTheDocument()
    })
    await user.click(
      within(screen.getByTestId(`custom-strategy-card-${savedCustom.name}`)).getByRole('button', {
        name: new RegExp(`^${savedCustom.name} Custom`),
      }),
    )
    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toHaveValue(savedCustom.name)
    })

    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    await user.click(screen.getByTitle(`Delete custom strategy ${savedCustom.name}`))

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toHaveValue('')
    })
  })

  it('loads a saved custom with enabled exits on and their values on the right', async () => {
    const user = userEvent.setup()
    useStudioCustomMocks()

    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForDefaultStrategy()

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Saved' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('radio', { name: 'Saved' }))
    await waitFor(() => {
      expect(screen.getByTestId(`custom-strategy-card-${savedCustom.name}`)).toBeInTheDocument()
    })
    await user.click(
      within(screen.getByTestId(`custom-strategy-card-${savedCustom.name}`)).getByRole('button', {
        name: new RegExp(`^${savedCustom.name} Custom`),
      }),
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toHaveValue(savedCustom.name)
      expect(screen.getByLabelText('Description')).toHaveValue(savedCustom.description!)
      expect(screen.getByRole('spinbutton', { name: 'Entry Period' })).toHaveValue(25)
    })

    expect(screen.getByRole('button', { name: /Rule A/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('spinbutton', { name: 'Rule A Offset' })).toHaveValue(0.05)
  })

  it('keeps the stacked layout while the studio stays mounted', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithQueryClient(<StrategyStudioHarness />)
    await waitForDefaultStrategy()

    await user.click(screen.getByRole('button', { name: /Studio Strategy/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Exit Strategies' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()

    rerender(<StrategyStudioHarness hidden />)
    rerender(<StrategyStudioHarness hidden={false} />)

    expect(screen.getByRole('heading', { name: 'Exit Strategies' })).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })
})
