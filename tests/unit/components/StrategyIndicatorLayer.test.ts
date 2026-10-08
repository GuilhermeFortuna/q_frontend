import { describe, expect, it } from 'vitest'

import { indicatorStroke } from '@/components/backtests/StrategyIndicatorLayer'
import type { ChartIndicatorSeries } from '@/types/backtesting'

const base: ChartIndicatorSeries = { key: 'sma', label: 'SMA', pane: 'price', values: [] }

describe('indicatorStroke', () => {
  it('falls back to a solid default line when styling is unset', () => {
    expect(indicatorStroke(base)).toEqual({
      stroke: '#c9a227',
      strokeWidth: 1.2,
      strokeDasharray: undefined,
      strokeLinecap: undefined,
    })
  })

  it('treats null styling from the API like unset', () => {
    expect(indicatorStroke({ ...base, line_style: null, line_width: null }).strokeWidth).toBe(1.2)
  })

  it.each([
    ['solid', undefined],
    ['dashed', '4 2'],
    ['dotted', '1 3'],
  ] as const)('maps %s to its dash pattern', (lineStyle, dasharray) => {
    expect(indicatorStroke({ ...base, line_style: lineStyle }).strokeDasharray).toBe(dasharray)
  })

  it('applies color and width, rounding dotted caps', () => {
    expect(
      indicatorStroke({ ...base, color: '#112233', line_style: 'dotted', line_width: 3 }),
    ).toMatchObject({ stroke: '#112233', strokeWidth: 3, strokeLinecap: 'round' })
  })
})
