import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { StrategyStudio } from '@/components/backtests/setup/StrategyStudio'
import { useBacktestConfig } from '@/lib/backtesting/useBacktestConfig'
import { handlers } from '@/mocks/handlers'
import { mockStrategies, resetMockCustomStrategies } from '@/mocks/data'
import { renderWithQueryClient } from '../testUtils'
import { mockExitCatalog, mockExitParamSpecs } from '../workspaces/exitConfiguratorFixtures'
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
    rule_a_offset: 0,
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
  return (
    <div hidden={hidden}>
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
  it('defaults to Entry and does not auto-switch on programmatic default selection', async () => {
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForDefaultStrategy()

    expect(screen.getByRole('tab', { name: 'Entry', selected: true })).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /^Exit & Targets/i, selected: false }),
    ).toBeInTheDocument()
  })

  it('switches to Exit when a user picks a strategy card and back to Entry via tab', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForDefaultStrategy()

    await user.click(screen.getByRole('button', { name: /MACD Crossover/i }))

    expect(
      screen.getByRole('tab', { name: /^Exit & Targets/i, selected: true }),
    ).toBeInTheDocument()
    expect(screen.getByText('Active:')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Entry', selected: false }))

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: 'Fast Period' })).toBeInTheDocument()
    })
  })

  it('edits entry params on Entry tab and exit params on Exit tab in the same flat bag', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForDefaultStrategy()

    await user.click(screen.getByRole('button', { name: /Studio Strategy/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('tab', { name: /^Exit & Targets/i, selected: true }),
      ).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: 'Entry', selected: false }))
    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: 'Entry Period' })).toBeInTheDocument()
    })

    const entryPeriod = screen.getByRole('spinbutton', { name: 'Entry Period' })
    await user.clear(entryPeriod)
    await user.type(entryPeriod, '15')

    await user.click(screen.getByRole('tab', { name: /^Exit & Targets/i, selected: false }))
    await user.click(screen.getByRole('switch', { name: 'Enable Rule A' }))
    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: 'Rule A Mult' })).toBeInTheDocument()
    })
    const ruleAInput = screen.getByRole('spinbutton', { name: 'Rule A Mult' })
    await user.clear(ruleAInput)
    await user.type(ruleAInput, '2')

    await user.click(screen.getByRole('tab', { name: 'Entry', selected: false }))
    expect(screen.getByRole('spinbutton', { name: 'Entry Period' })).toHaveValue(15)

    await user.click(screen.getByRole('tab', { name: /^Exit & Targets/i, selected: false }))
    expect(screen.getByRole('spinbutton', { name: 'Rule A Mult' })).toHaveValue(2)
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

  it('clears the draft with New and resets after deleting the loaded custom', async () => {
    const user = userEvent.setup()
    useStudioCustomMocks()

    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForDefaultStrategy()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Saved' }))
    await waitFor(() => {
      expect(screen.getByTestId(`custom-strategy-card-${savedCustom.name}`)).toBeInTheDocument()
    })
    await user.click(screen.getByTestId(`custom-strategy-card-${savedCustom.name}`))

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toHaveValue(savedCustom.name)
    })

    await user.click(screen.getByRole('button', { name: 'New' }))

    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByLabelText('Description')).toHaveValue('')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Saved' }))
    await waitFor(() => {
      expect(screen.getByTestId(`custom-strategy-card-${savedCustom.name}`)).toBeInTheDocument()
    })
    await user.click(screen.getByTestId(`custom-strategy-card-${savedCustom.name}`))
    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toHaveValue(savedCustom.name)
    })

    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    await user.click(screen.getByTitle(`Delete custom strategy ${savedCustom.name}`))

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toHaveValue('')
    })
  })

  it('loads a saved custom with enabled exits visible on the Exit tab', async () => {
    const user = userEvent.setup()
    useStudioCustomMocks()

    renderWithQueryClient(<StrategyStudioHarness />)
    await waitForDefaultStrategy()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Saved' }))
    await waitFor(() => {
      expect(screen.getByTestId(`custom-strategy-card-${savedCustom.name}`)).toBeInTheDocument()
    })
    await user.click(screen.getByTestId(`custom-strategy-card-${savedCustom.name}`))

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toHaveValue(savedCustom.name)
      expect(screen.getByLabelText('Description')).toHaveValue(savedCustom.description!)
    })

    expect(
      screen.getByRole('tab', { name: /Exit & Targets \(1\)/i, selected: true }),
    ).toBeInTheDocument()

    const exitPanel = document.getElementById('studio-panel-exit')
    expect(exitPanel).not.toBeNull()
    expect(within(exitPanel!).getByRole('spinbutton', { name: 'Rule A Mult' })).toHaveValue(2)
  })

  it('preserves the active tab while the studio stays mounted', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithQueryClient(<StrategyStudioHarness />)
    await waitForDefaultStrategy()

    await user.click(screen.getByRole('button', { name: /MACD Crossover/i }))
    expect(
      screen.getByRole('tab', { name: /^Exit & Targets/i, selected: true }),
    ).toBeInTheDocument()

    rerender(<StrategyStudioHarness hidden />)
    rerender(<StrategyStudioHarness hidden={false} />)

    expect(
      screen.getByRole('tab', { name: /^Exit & Targets/i, selected: true }),
    ).toBeInTheDocument()
  })
})
