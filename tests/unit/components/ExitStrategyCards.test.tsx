import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { ExitStrategyCards } from '@/components/backtests/setup/ExitStrategyCards'
import { mockExitCatalog } from '../workspaces/exitConfiguratorFixtures'

describe('ExitStrategyCards', () => {
  it('renders one group per present exit_group', () => {
    render(
      <ExitStrategyCards
        rules={mockExitCatalog.exit_rules}
        isEnabled={() => false}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Stop Loss' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Trailing Stops' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Time Exits' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Profit Targets' })).not.toBeInTheDocument()
  })

  it('reflects isEnabled on each switch', () => {
    render(
      <ExitStrategyCards
        rules={mockExitCatalog.exit_rules}
        isEnabled={(rule) => rule.id === 'rule_a'}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByRole('switch', { name: 'Disable Rule A' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('switch', { name: 'Enable Rule B' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('fires onToggle when a switch is clicked', () => {
    const onToggle = vi.fn()
    render(
      <ExitStrategyCards
        rules={mockExitCatalog.exit_rules}
        isEnabled={() => false}
        onToggle={onToggle}
      />,
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Enable Rule B' }))
    expect(onToggle).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rule_b', label: 'Rule B' }),
    )
  })

  it('renders nothing when rules is empty', () => {
    const { container } = render(
      <ExitStrategyCards rules={[]} isEnabled={() => false} onToggle={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('uses a custom heading when provided', () => {
    render(
      <ExitStrategyCards
        rules={mockExitCatalog.exit_rules.slice(0, 1)}
        isEnabled={() => false}
        onToggle={vi.fn()}
        heading="Custom Exit Heading"
      />,
    )

    expect(screen.getByRole('heading', { name: 'Custom Exit Heading' })).toBeInTheDocument()
  })
})
