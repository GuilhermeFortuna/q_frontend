import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { useExitRuleCatalog, useStrategies } from '@/api/queries/strategies'
import {
  useCustomStrategies,
  useDeleteCustomStrategy,
  useSaveCustomStrategy,
} from '@/api/queries/customStrategies'
import { StrategyWorkspace } from '@/workspaces/strategy/StrategyWorkspace'
import { buildWorkbenchSummary } from '@/workspaces/strategy/StrategyWorkbenchActionBar'
import { renderWithQueryClient } from '../testUtils'
import type { CustomStrategy, StrategiesResponse } from '@/types/strategies'
import { mockExitCatalog } from './exitConfiguratorFixtures'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('@/api/queries/strategies', () => ({
  useStrategies: vi.fn(),
  useExitRuleCatalog: vi.fn(),
}))

vi.mock('@/api/queries/customStrategies', () => ({
  useCustomStrategies: vi.fn(),
  useSaveCustomStrategy: vi.fn(),
  useDeleteCustomStrategy: vi.fn(),
}))

const mockedUseStrategies = vi.mocked(useStrategies)
const mockedUseExitRuleCatalog = vi.mocked(useExitRuleCatalog)
const mockedUseCustomStrategies = vi.mocked(useCustomStrategies)
const mockedUseSaveCustomStrategy = vi.mocked(useSaveCustomStrategy)
const mockedUseDeleteCustomStrategy = vi.mocked(useDeleteCustomStrategy)

const mockStrategyResponse: StrategiesResponse = {
  strategies: [
    {
      name: 'TestStrategy',
      label: 'Test Strategy',
      description: 'Mock strategy for exit workbench tests.',
      thesis: 'Entry thesis for testing.',
      params: [
        {
          name: 'entry_period',
          label: 'Entry Period',
          type: 'int',
          default: 20,
          hint: 'Entry hint from payload.',
        },
        {
          name: 'rule_a_enable',
          label: 'Rule A Mult',
          type: 'float',
          default: 0.0,
          exit_group: 'stop_loss',
          hint: 'Stop loss hint from payload.',
        },
        {
          name: 'rule_b_enable',
          label: 'Rule B Mult',
          type: 'float',
          default: 0.0,
          exit_group: 'trailing',
          hint: 'Trailing hint from payload.',
        },
        {
          name: 'shared_indicator',
          label: 'Shared Indicator',
          type: 'int',
          default: 14,
          exit_group: 'general',
          hint: 'Shared indicator hint.',
        },
      ],
    },
  ],
}

const savedStrategy: CustomStrategy = {
  name: 'MySaved',
  base_strategy: 'TestStrategy',
  description: 'Saved desc',
  parameters: {
    entry_period: 25,
    rule_a_enable: 2,
    rule_b_enable: 0,
    shared_indicator: 14,
  },
}

describe('StrategyWorkspace layout', () => {
  beforeEach(() => {
    mockedUseStrategies.mockReturnValue({
      data: mockStrategyResponse,
      isLoading: false,
    } as unknown as ReturnType<typeof useStrategies>)
    mockedUseExitRuleCatalog.mockReturnValue({
      data: mockExitCatalog,
      isLoading: false,
    } as unknown as ReturnType<typeof useExitRuleCatalog>)
    mockedUseCustomStrategies.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useCustomStrategies>)
    mockedUseSaveCustomStrategy.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useSaveCustomStrategy>)
    mockedUseDeleteCustomStrategy.mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useDeleteCustomStrategy>)
  })

  it('renders the rebalanced layout with a compact empty saved rail', async () => {
    renderWithQueryClient(<StrategyWorkspace />)

    await waitFor(() => {
      expect(screen.getByTestId('workbench-saved-rail')).toBeInTheDocument()
    })

    expect(screen.getByTestId('workbench-form-panel')).toBeInTheDocument()
    expect(screen.getByTestId('workbench-saved-empty')).toBeInTheDocument()
    expect(screen.getByText('No saved strategies yet.')).toBeInTheDocument()
    expect(screen.queryByText(/Create your first one/i)).not.toBeInTheDocument()
  })

  it('shows the sticky action bar summary and disables save when name is empty', async () => {
    renderWithQueryClient(<StrategyWorkspace />)

    await waitFor(() => {
      expect(screen.getByTestId('workbench-action-bar')).toBeInTheDocument()
    })

    expect(screen.getByTestId('workbench-summary')).toHaveTextContent(buildWorkbenchSummary(0, ''))
    expect(screen.getByRole('button', { name: 'Save Strategy' })).toBeDisabled()
  })

  it('reflects active exit count in the summary when exits are enabled', async () => {
    renderWithQueryClient(<StrategyWorkspace />)

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Enable Rule A' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('switch', { name: 'Enable Rule A' }))

    await waitFor(() => {
      expect(screen.getByTestId('workbench-summary')).toHaveTextContent('1 exit active')
    })
  })

  it('renders entry params with compact hints and a collapsible thesis', async () => {
    renderWithQueryClient(<StrategyWorkspace />)

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: 'Entry Period' })).toBeInTheDocument()
    })

    expect(screen.queryByText('Entry hint from payload.')).not.toBeInTheDocument()
    expect(screen.getByText('Entry thesis for testing.')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('workbench-thesis-toggle'))
    expect(screen.queryByText('Entry thesis for testing.')).not.toBeInTheDocument()
  })

  it('loads a saved strategy and posts the same payload shape on save', async () => {
    const mutate = vi.fn()
    mockedUseSaveCustomStrategy.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSaveCustomStrategy>)
    mockedUseCustomStrategies.mockReturnValue({
      data: [savedStrategy],
      isLoading: false,
    } as unknown as ReturnType<typeof useCustomStrategies>)

    renderWithQueryClient(<StrategyWorkspace />)

    await waitFor(() => {
      expect(screen.getByText('MySaved')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('MySaved'))

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: 'Entry Period' })).toHaveValue(25)
    })

    expect(screen.getByTestId('workbench-summary')).toHaveTextContent('1 exit active')

    fireEvent.click(screen.getByRole('button', { name: 'Save Strategy' }))

    expect(mutate).toHaveBeenCalledWith(
      {
        name: 'MySaved',
        base_strategy: 'TestStrategy',
        description: 'Saved desc',
        parameters: savedStrategy.parameters,
      },
      expect.any(Object),
    )
  })

  it('renders metadata-driven exit toggle cards', async () => {
    renderWithQueryClient(<StrategyWorkspace />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Stop Loss' })).toBeInTheDocument()
    })

    expect(screen.getByRole('switch', { name: 'Enable Rule A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preset A+B' })).toBeInTheDocument()
  })

  it('does not render exit configurator when the catalog is empty', async () => {
    mockedUseExitRuleCatalog.mockReturnValue({
      data: { exit_rules: [], shared_exit_params: [], exit_presets: [] },
      isLoading: false,
    } as unknown as ReturnType<typeof useExitRuleCatalog>)

    renderWithQueryClient(<StrategyWorkspace />)

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: 'Entry Period' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('heading', { name: 'Stop Loss' })).not.toBeInTheDocument()
    expect(screen.getByText('Exit parameters not available for this strategy.')).toBeInTheDocument()
  })
})

describe('buildWorkbenchSummary', () => {
  it('joins exit count and name validation', () => {
    expect(buildWorkbenchSummary(3, '')).toBe('3 exits active · name required')
    expect(buildWorkbenchSummary(1, 'MyStrategy')).toBe('1 exit active')
  })
})
