import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { StrategyParamFields } from '@/components/shared/StrategyParamFields'
import type { StrategyParamSpec } from '@/types/strategies'

const mixedParams: StrategyParamSpec[] = [
  { name: 'period', label: 'Period', type: 'int', default: 14, min: 2, max: 200, step: 1 },
  {
    name: 'threshold',
    label: 'Threshold',
    type: 'float',
    default: 0.5,
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    name: 'ma_type',
    label: 'MA Type',
    type: 'categorical',
    default: 'sma',
    choices: ['sma', 'ema'],
  },
]

describe('StrategyParamFields', () => {
  it('renders number inputs for int and float params', () => {
    render(
      <StrategyParamFields
        params={mixedParams}
        values={{ period: 14, threshold: 0.5, ma_type: 'sma' }}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Period')).toHaveAttribute('type', 'number')
    expect(screen.getByLabelText('Threshold')).toHaveAttribute('type', 'number')
  })

  it('renders a select for categorical params', () => {
    render(
      <StrategyParamFields
        params={mixedParams}
        values={{ period: 14, threshold: 0.5, ma_type: 'sma' }}
        onChange={vi.fn()}
      />,
    )

    const select = screen.getByLabelText('MA Type')
    expect(select.tagName).toBe('SELECT')
    expect(select).toHaveValue('sma')
  })

  it('renders param hints when showHints is enabled', () => {
    render(
      <StrategyParamFields
        params={[
          {
            name: 'period',
            label: 'Period',
            type: 'int',
            default: 14,
            hint: 'Shorter = noisier.',
          },
        ]}
        values={{ period: 14 }}
        onChange={vi.fn()}
        showHints
      />,
    )

    expect(screen.getByText('Shorter = noisier.')).toBeInTheDocument()
  })

  it('reports value changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <StrategyParamFields
        params={mixedParams}
        values={{ period: 14, threshold: 0.5, ma_type: 'sma' }}
        onChange={onChange}
      />,
    )

    await user.selectOptions(screen.getByLabelText('MA Type'), 'ema')
    expect(onChange).toHaveBeenCalledWith('ma_type', 'ema')

    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '21' } })
    expect(onChange).toHaveBeenCalledWith('period', 21)
  })
})

describe('StrategyParamFields for strategy-file parameters', () => {
  const fileParams: StrategyParamSpec[] = [
    { name: 'use_filter', label: 'Use filter', type: 'bool', default: true },
    { name: 'enter_after', label: 'Enter after', type: 'time', default: '10:00' },
  ]

  it('renders a checkbox for a bool param and reports the toggled value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <StrategyParamFields
        params={fileParams}
        values={{ use_filter: true, enter_after: '10:00' }}
        onChange={onChange}
      />,
    )

    const checkbox = screen.getByLabelText('Use filter')
    expect(checkbox).toHaveAttribute('type', 'checkbox')
    expect(checkbox).toBeChecked()

    await user.click(checkbox)

    expect(onChange).toHaveBeenCalledWith('use_filter', false)
  })

  it('renders an HH:MM time input and reports the chosen time', () => {
    const onChange = vi.fn()
    render(
      <StrategyParamFields
        params={fileParams}
        values={{ use_filter: true, enter_after: '10:00' }}
        onChange={onChange}
      />,
    )

    const input = screen.getByLabelText('Enter after')
    expect(input).toHaveAttribute('type', 'time')
    expect(input).toHaveValue('10:00')

    fireEvent.change(input, { target: { value: '09:30' } })

    expect(onChange).toHaveBeenCalledWith('enter_after', '09:30')
  })
})
