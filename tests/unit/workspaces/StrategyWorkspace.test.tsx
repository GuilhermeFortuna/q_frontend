import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { useStrategies } from '@/api/queries/strategies'
import {
  useCustomStrategies,
  useDeleteCustomStrategy,
  useSaveCustomStrategy,
} from '@/api/queries/customStrategies'
import { StrategyWorkspace } from '@/workspaces/strategy/StrategyWorkspace'
import { renderWithQueryClient } from '../testUtils'
import type { StrategiesResponse } from '@/types/strategies'

vi.mock('@/api/queries/strategies', () => ({
  useStrategies: vi.fn(),
}))

vi.mock('@/api/queries/customStrategies', () => ({
  useCustomStrategies: vi.fn(),
  useSaveCustomStrategy: vi.fn(),
  useDeleteCustomStrategy: vi.fn(),
}))

const mockedUseStrategies = vi.mocked(useStrategies)
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
          name: 'fixed_sl',
          label: 'Fixed SL',
          type: 'float',
          default: 0.0,
          exit_group: 'stop_loss',
          hint: 'Stop loss hint from payload.',
        },
        {
          name: 'trail_pct',
          label: 'Trail Pct',
          type: 'float',
          default: 0.0,
          exit_group: 'trailing',
          hint: 'Trailing hint from payload.',
        },
        {
          name: 'take_profit',
          label: 'Take Profit',
          type: 'float',
          default: 0.0,
          exit_group: 'target',
          hint: 'Target hint from payload.',
        },
        {
          name: 'max_bars',
          label: 'Max Bars',
          type: 'int',
          default: 0,
          exit_group: 'time',
          hint: 'Time stop hint from payload.',
        },
        {
          name: 'future_rule',
          label: 'Future Rule',
          type: 'float',
          default: 0.0,
          exit_group:
            'channel' as StrategiesResponse['strategies'][number]['params'][number]['exit_group'],
          hint: 'Unknown group hint from payload.',
        },
      ],
    },
  ],
}

describe('StrategyWorkspace exit workbench', () => {
  beforeEach(() => {
    mockedUseStrategies.mockReturnValue({
      data: mockStrategyResponse,
      isLoading: false,
    } as unknown as ReturnType<typeof useStrategies>)
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

  it('renders entry params in the entry section and grouped exit cards from exit_group', async () => {
    renderWithQueryClient(<StrategyWorkspace />)

    await waitFor(() => {
      expect(screen.getByLabelText('Entry Period')).toBeInTheDocument()
    })

    expect(screen.getByText('Entry hint from payload.')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Stop Loss' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Trailing Stops' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Profit Targets' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Time Exits' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Other Exits' })).toBeInTheDocument()

    expect(screen.getByLabelText('Fixed SL')).toBeInTheDocument()
    expect(screen.getByText('Stop loss hint from payload.')).toBeInTheDocument()
    expect(screen.getByText('Trailing hint from payload.')).toBeInTheDocument()
    expect(screen.getByText('Target hint from payload.')).toBeInTheDocument()
    expect(screen.getByText('Time stop hint from payload.')).toBeInTheDocument()
    expect(screen.getByText('Unknown group hint from payload.')).toBeInTheDocument()
  })

  it('does not render exit cards when the strategy has no exit_group params', async () => {
    mockedUseStrategies.mockReturnValue({
      data: {
        strategies: [
          {
            name: 'EntryOnly',
            label: 'Entry Only',
            description: 'No exits.',
            params: [
              {
                name: 'entry_period',
                label: 'Entry Period',
                type: 'int',
                default: 20,
              },
            ],
          },
        ],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useStrategies>)

    renderWithQueryClient(<StrategyWorkspace />)

    await waitFor(() => {
      expect(screen.getByLabelText('Entry Period')).toBeInTheDocument()
    })

    expect(screen.queryByRole('heading', { name: 'Stop Loss' })).not.toBeInTheDocument()
    expect(screen.getByText('Exit parameters not available for this strategy.')).toBeInTheDocument()
  })
})
