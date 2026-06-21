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

  it('shows entry params plus search fields for candidate exits including enable params', () => {
    render(
      <OptimizeStrategyDetailPanel
        strategy={strategyWithExitParams}
        entryParamSpecs={[strategyWithExitParams.params[0]]}
        candidateExitParamSpecs={[
          mockExitParamSpecs[0],
          mockExitParamSpecs[1],
          mockExitParamSpecs[4],
        ]}
        applicableExitRules={mockExitCatalog.exit_rules}
        searchSpace={defaultSearchSpaceFromSpecs(strategyWithExitParams.params)}
        onSearchSpaceChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Entry Param')).toBeInTheDocument()
    expect(screen.getByText('Rule A Mult')).toBeInTheDocument()
    expect(screen.getByText('Rule A Offset')).toBeInTheDocument()
    expect(screen.getByText('Shared Indicator')).toBeInTheDocument()
  })

  it('shows a hint when applicable exits exist but none are candidates', () => {
    render(
      <OptimizeStrategyDetailPanel
        strategy={strategyWithExitParams}
        entryParamSpecs={[strategyWithExitParams.params[0]]}
        candidateExitParamSpecs={[]}
        applicableExitRules={mockExitCatalog.exit_rules}
        searchSpace={defaultSearchSpaceFromSpecs(strategyWithExitParams.params)}
        onSearchSpaceChange={vi.fn()}
      />,
    )

    expect(
      screen.getByText(
        'Select an exit strategy to include it in the search (on/off and magnitude).',
      ),
    ).toBeInTheDocument()
  })
})
