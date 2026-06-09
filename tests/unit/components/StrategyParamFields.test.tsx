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
