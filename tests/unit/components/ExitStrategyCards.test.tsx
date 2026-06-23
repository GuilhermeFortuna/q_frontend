import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { ExitStrategyCards } from '@/components/backtests/setup/ExitStrategyCards'
import { mockExitCatalog, mockExitParamSpecs } from '../workspaces/exitConfiguratorFixtures'

describe('ExitStrategyCards', () => {
  it('renders one card per applicable rule with its group tag and param count', () => {
    render(
      <ExitStrategyCards
        rules={mockExitCatalog.exit_rules}
        exitParamSpecs={mockExitParamSpecs}
        isEnabled={() => false}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Rule A/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rule B/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rule C/i })).toBeInTheDocument()

    expect(screen.getAllByText('Stop Loss').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Trailing Stops').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Time Exits').length).toBeGreaterThan(0)

    expect(screen.getByText('2 params')).toBeInTheDocument()
    expect(screen.getAllByText('1 param')).toHaveLength(2)

    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Stop Loss' })).not.toBeInTheDocument()
  })

  it('reflects isEnabled via aria-pressed and selected styling', () => {
    render(
      <ExitStrategyCards
        rules={mockExitCatalog.exit_rules}
        exitParamSpecs={mockExitParamSpecs}
        isEnabled={(rule) => rule.id === 'rule_a'}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Rule A/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Rule B/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('fires onToggle when a card is clicked', () => {
    const onToggle = vi.fn()
    render(
      <ExitStrategyCards
        rules={mockExitCatalog.exit_rules}
        exitParamSpecs={mockExitParamSpecs}
        isEnabled={() => false}
        onToggle={onToggle}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Rule B/i }))
    expect(onToggle).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rule_b', label: 'Rule B' }),
    )
  })

  it('fires onToggle when clicking an enabled card to disable it', () => {
    const onToggle = vi.fn()
    render(
      <ExitStrategyCards
        rules={mockExitCatalog.exit_rules}
        exitParamSpecs={mockExitParamSpecs}
        isEnabled={(rule) => rule.id === 'rule_a'}
        onToggle={onToggle}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Rule A/i }))
    expect(onToggle).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rule_a', label: 'Rule A' }),
    )
  })

  it('renders nothing when rules is empty', () => {
    const { container } = render(
      <ExitStrategyCards
        rules={[]}
        exitParamSpecs={mockExitParamSpecs}
        isEnabled={() => false}
        onToggle={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('uses a custom heading and subheading when provided', () => {
    render(
      <ExitStrategyCards
        rules={mockExitCatalog.exit_rules.slice(0, 1)}
        exitParamSpecs={mockExitParamSpecs}
        isEnabled={() => false}
        onToggle={vi.fn()}
        heading="Custom Exit Heading"
        subheading="Selected exits are searched."
      />,
    )

    expect(screen.getByRole('heading', { name: 'Custom Exit Heading' })).toBeInTheDocument()
    expect(screen.getByText('Selected exits are searched.')).toBeInTheDocument()
  })
})
