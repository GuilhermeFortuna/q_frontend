import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { OptimizeStrategyDetailPanel } from '@/components/optimize/setup/OptimizeStrategyDetailPanel'
import { defaultSearchSpaceFromSpecs } from '@/lib/strategies/strategyParams'
import { mockExitCatalog, mockExitParamSpecs } from '../workspaces/exitConfiguratorFixtures'
import type { StrategyInfo } from '@/types/strategies'

describe('OptimizeStrategyDetailPanel exit search space', () => {
  const strategyWithExitParams: StrategyInfo = {
    name: 'ExitRuleStrategy',
    label: 'Exit Rule Strategy',
    description: 'Strategy with tunable exit params',
    params: [
      { name: 'entry_param', label: 'Entry Param', type: 'int', default: 10, min: 1, max: 20 },
      ...mockExitParamSpecs,
    ],
  }

  const baseProps = {
    entries: [{ slotId: 'slot-0', strategy: strategyWithExitParams.name, params: {} }],
    strategies: [strategyWithExitParams],
    customStrategies: [],
    entrySearchSpaces: {
      'slot-0': defaultSearchSpaceFromSpecs([strategyWithExitParams.params[0]]),
    },
    exitSearchSpace: defaultSearchSpaceFromSpecs(strategyWithExitParams.params),
    managerSearchSpace: {},
    entryManager: { kind: 'or' as const, params: {} },
    managerParamSpecs: [],
    resolveEntryParamSpecs: () => [strategyWithExitParams.params[0]],
    onEntrySearchSpaceChange: vi.fn(),
    onExitSearchSpaceChange: vi.fn(),
    onManagerSearchSpaceChange: vi.fn(),
    onRemoveEntry: vi.fn(),
  }

  it('shows entry params plus search fields for candidate exits including enable params', () => {
    render(
      <OptimizeStrategyDetailPanel
        {...baseProps}
        candidateExitParamSpecs={[
          mockExitParamSpecs[0],
          mockExitParamSpecs[1],
          mockExitParamSpecs[4],
        ]}
        applicableExitRules={mockExitCatalog.exit_rules}
      />,
    )

    expect(screen.getByText(/e0 · Exit Rule Strategy/i)).toBeInTheDocument()
    expect(screen.getByText('Entry Param')).toBeInTheDocument()
    expect(screen.getByText('Rule A Mult')).toBeInTheDocument()
    expect(screen.getByText('Rule A Offset')).toBeInTheDocument()
    expect(screen.getByText('Shared Indicator')).toBeInTheDocument()
  })

  it('shows a hint when applicable exits exist but none are candidates', () => {
    render(
      <OptimizeStrategyDetailPanel
        {...baseProps}
        candidateExitParamSpecs={[]}
        applicableExitRules={mockExitCatalog.exit_rules}
      />,
    )

    expect(
      screen.getByText(
        'Select an exit strategy to include it in the search (on/off and magnitude).',
      ),
    ).toBeInTheDocument()
  })

  it('surfaces vote_threshold control for majority manager', () => {
    render(
      <OptimizeStrategyDetailPanel
        {...baseProps}
        entryManager={{ kind: 'majority', params: { vote_threshold: 2 } }}
        managerParamSpecs={[
          {
            name: 'vote_threshold',
            label: 'Vote Threshold',
            type: 'int',
            default: 2,
            min: 1,
            max: 2,
            step: 1,
          },
        ]}
        managerSearchSpace={defaultSearchSpaceFromSpecs([
          {
            name: 'vote_threshold',
            label: 'Vote Threshold',
            type: 'int',
            default: 2,
            min: 1,
            max: 2,
            step: 1,
          },
        ])}
        candidateExitParamSpecs={[]}
        applicableExitRules={[]}
      />,
    )

    expect(screen.getByText('Vote Threshold')).toBeInTheDocument()
  })
})
