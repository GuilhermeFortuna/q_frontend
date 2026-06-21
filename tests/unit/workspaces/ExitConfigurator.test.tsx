import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { ExitConfigurator } from '@/workspaces/strategy/ExitConfigurator'
import {
  mockExitCatalog,
  mockExitParamSpecs,
  mockSavedStrategyParams,
} from './exitConfiguratorFixtures'
import { defaultEnableValue } from '@/workspaces/strategy/exitRuleSemantics'

describe('ExitConfigurator', () => {
  it('renders one section per present exit group from the catalog', () => {
    render(
      <ExitConfigurator
        exitRules={mockExitCatalog.exit_rules}
        sharedExitParams={mockExitCatalog.shared_exit_params}
        exitPresets={mockExitCatalog.exit_presets}
        exitParamSpecs={mockExitParamSpecs}
        paramValues={{}}
        onChange={vi.fn()}
        onParamsMerge={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Stop Loss' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Trailing Stops' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Time Exits' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Profit Targets' })).not.toBeInTheDocument()
  })

  it('renders disabled rules collapsed and enabled rules expanded with params', () => {
    render(
      <ExitConfigurator
        exitRules={mockExitCatalog.exit_rules}
        sharedExitParams={mockExitCatalog.shared_exit_params}
        exitPresets={mockExitCatalog.exit_presets}
        exitParamSpecs={mockExitParamSpecs}
        paramValues={{ rule_a_enable: 2, rule_b_enable: 0, rule_c_enable: 0 }}
        onChange={vi.fn()}
        onParamsMerge={vi.fn()}
      />,
    )

    expect(screen.getByRole('spinbutton', { name: 'Rule A Mult' })).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: 'Rule B Mult' })).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Disable Rule A' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('switch', { name: 'Enable Rule B' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('toggling a card on sets enable_value from the catalog and toggling off zeroes it', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <ExitConfigurator
        exitRules={mockExitCatalog.exit_rules}
        sharedExitParams={mockExitCatalog.shared_exit_params}
        exitPresets={[]}
        exitParamSpecs={mockExitParamSpecs}
        paramValues={{ rule_b_enable: 0 }}
        onChange={onChange}
        onParamsMerge={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Enable Rule B' }))
    expect(onChange).toHaveBeenCalledWith('rule_b_enable', 3)

    onChange.mockClear()
    rerender(
      <ExitConfigurator
        exitRules={mockExitCatalog.exit_rules}
        sharedExitParams={mockExitCatalog.shared_exit_params}
        exitPresets={[]}
        exitParamSpecs={mockExitParamSpecs}
        paramValues={{ rule_b_enable: 3 }}
        onChange={onChange}
        onParamsMerge={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('switch', { name: 'Disable Rule B' }))
    expect(onChange).toHaveBeenCalledWith('rule_b_enable', 0)
  })

  it('falls back to defaultEnableValue when enable_value is missing or zero', () => {
    const onChange = vi.fn()
    render(
      <ExitConfigurator
        exitRules={mockExitCatalog.exit_rules}
        sharedExitParams={mockExitCatalog.shared_exit_params}
        exitPresets={[]}
        exitParamSpecs={mockExitParamSpecs}
        paramValues={{ rule_c_enable: 0 }}
        onChange={onChange}
        onParamsMerge={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Enable Rule C' }))
    const enableSpec = mockExitParamSpecs.find((spec) => spec.name === 'rule_c_enable')
    expect(onChange).toHaveBeenCalledWith('rule_c_enable', defaultEnableValue(enableSpec!))
  })

  it('shows ACTIVE chips for enabled rules and an empty state when none are enabled', () => {
    const { rerender } = render(
      <ExitConfigurator
        exitRules={mockExitCatalog.exit_rules}
        sharedExitParams={mockExitCatalog.shared_exit_params}
        exitPresets={[]}
        exitParamSpecs={mockExitParamSpecs}
        paramValues={{ rule_a_enable: 0, rule_b_enable: 0, rule_c_enable: 0 }}
        onChange={vi.fn()}
        onParamsMerge={vi.fn()}
      />,
    )

    expect(
      screen.getByText('No exits enabled — pick a preset or toggle one on.'),
    ).toBeInTheDocument()

    rerender(
      <ExitConfigurator
        exitRules={mockExitCatalog.exit_rules}
        sharedExitParams={mockExitCatalog.shared_exit_params}
        exitPresets={[]}
        exitParamSpecs={mockExitParamSpecs}
        paramValues={{ rule_a_enable: 2, rule_b_enable: 3, rule_c_enable: 0 }}
        onChange={vi.fn()}
        onParamsMerge={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Rule A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rule B' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rule C' })).not.toBeInTheDocument()
  })

  it('merges preset parameters without clearing unrelated exits', () => {
    const onParamsMerge = vi.fn()
    render(
      <ExitConfigurator
        exitRules={mockExitCatalog.exit_rules}
        sharedExitParams={mockExitCatalog.shared_exit_params}
        exitPresets={mockExitCatalog.exit_presets}
        exitParamSpecs={mockExitParamSpecs}
        paramValues={{ rule_c_enable: 5 }}
        onChange={vi.fn()}
        onParamsMerge={onParamsMerge}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Preset A+B' }))
    expect(onParamsMerge).toHaveBeenCalledWith(mockExitCatalog.exit_presets[0].parameters)
  })

  it('shows Indicator Settings only when an enabled rule requires shared params', () => {
    const { rerender } = render(
      <ExitConfigurator
        exitRules={mockExitCatalog.exit_rules}
        sharedExitParams={mockExitCatalog.shared_exit_params}
        exitPresets={[]}
        exitParamSpecs={mockExitParamSpecs}
        paramValues={{ rule_a_enable: 2, rule_b_enable: 0 }}
        onChange={vi.fn()}
        onParamsMerge={vi.fn()}
      />,
    )

    expect(screen.queryByRole('heading', { name: 'Indicator Settings' })).not.toBeInTheDocument()

    rerender(
      <ExitConfigurator
        exitRules={mockExitCatalog.exit_rules}
        sharedExitParams={mockExitCatalog.shared_exit_params}
        exitPresets={[]}
        exitParamSpecs={mockExitParamSpecs}
        paramValues={{ rule_a_enable: 0, rule_b_enable: 3, shared_indicator: 14 }}
        onChange={vi.fn()}
        onParamsMerge={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Indicator Settings' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Shared Indicator' })).toBeInTheDocument()
  })

  it('reflects a saved strategy with multiple enabled exits', () => {
    render(
      <ExitConfigurator
        exitRules={mockExitCatalog.exit_rules}
        sharedExitParams={mockExitCatalog.shared_exit_params}
        exitPresets={[]}
        exitParamSpecs={mockExitParamSpecs}
        paramValues={mockSavedStrategyParams}
        onChange={vi.fn()}
        onParamsMerge={vi.fn()}
      />,
    )

    expect(screen.getByRole('switch', { name: 'Disable Rule B' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('spinbutton', { name: 'Rule B Mult' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Indicator Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rule B' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rule A' })).not.toBeInTheDocument()
  })

  it('clear all exits zeroes every enable param from the catalog', () => {
    const onParamsMerge = vi.fn()
    render(
      <ExitConfigurator
        exitRules={mockExitCatalog.exit_rules}
        sharedExitParams={mockExitCatalog.shared_exit_params}
        exitPresets={[]}
        exitParamSpecs={mockExitParamSpecs}
        paramValues={{ rule_a_enable: 2, rule_b_enable: 3, rule_c_enable: 10 }}
        onChange={vi.fn()}
        onParamsMerge={onParamsMerge}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Clear all exits' }))
    expect(onParamsMerge).toHaveBeenCalledWith({
      rule_a_enable: 0,
      rule_b_enable: 0,
      rule_c_enable: 0,
    })
  })
})

describe('exit configurator components avoid hard-coded exit param names', () => {
  const forbiddenParamNames = [
    'stop_loss_pct',
    'stop_loss_atr',
    'take_profit_pct',
    'trailing_stop_pct',
    'chandelier_atr_mult',
    'breakeven_trigger_pct',
    'psar_af_start',
    'donchian_exit_period',
    'target_ratchet_atr',
    'max_bars_in_trade',
    'atr_period',
  ]

  const componentPaths = [
    'src/workspaces/strategy/ExitConfigurator.tsx',
    'src/workspaces/strategy/ExitRuleCard.tsx',
  ]

  it.each(componentPaths)('%s contains no exit param literals', (relativePath) => {
    const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8')
    for (const paramName of forbiddenParamNames) {
      expect(source).not.toContain(paramName)
    }
  })
})
