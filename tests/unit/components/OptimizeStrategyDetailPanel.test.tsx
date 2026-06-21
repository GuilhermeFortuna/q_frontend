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

  it('shows entry params plus tunable fields for enabled exits', () => {
    render(
      <OptimizeStrategyDetailPanel
        strategy={strategyWithExitParams}
        entryParamSpecs={[strategyWithExitParams.params[0]]}
        enabledExitParamSpecs={[mockExitParamSpecs[1], mockExitParamSpecs[4]]}
        applicableExitRules={mockExitCatalog.exit_rules}
        searchSpace={defaultSearchSpaceFromSpecs(strategyWithExitParams.params)}
        onSearchSpaceChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Entry Param')).toBeInTheDocument()
    expect(screen.getByText('Rule A Offset')).toBeInTheDocument()
    expect(screen.getByText('Shared Indicator')).toBeInTheDocument()
    expect(screen.queryByText('Rule A Mult')).not.toBeInTheDocument()
  })

  it('shows a hint when applicable exits exist but none are enabled', () => {
    render(
      <OptimizeStrategyDetailPanel
        strategy={strategyWithExitParams}
        entryParamSpecs={[strategyWithExitParams.params[0]]}
        enabledExitParamSpecs={[]}
        applicableExitRules={mockExitCatalog.exit_rules}
        searchSpace={defaultSearchSpaceFromSpecs(strategyWithExitParams.params)}
        onSearchSpaceChange={vi.fn()}
      />,
    )

    expect(
      screen.getByText('Toggle an exit strategy to optimize its parameters.'),
    ).toBeInTheDocument()
  })
})
