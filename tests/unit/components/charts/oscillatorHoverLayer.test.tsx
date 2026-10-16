import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { OscillatorHoverLayer } from '@/components/charts/layers/OscillatorHoverLayer'
import type { ProcessedBar } from '@/components/charts/types/chart'
import type { LinearScale } from '@/components/charts/types/scales'
import { scaleLinear } from '@visx/scale'

const bar = { index: 2, timestamp: '2024-06-03T00:00:00.000Z' } as ProcessedBar

const scale = scaleLinear<number>({ domain: [0, 100], range: [150, 100] }) as LinearScale

const group = {
  instanceKey: 'rsi:{"period":5}',
  catalogId: 'rsi',
  label: 'RSI',
  unit: null,
  config: { id: 'rsi', enabled: true, parameters: { period: 5 } },
  outputs: [
    { outputKey: 'rsi', label: 'RSI', values: [null, null, 61.2345] },
    { outputKey: 'signal', label: 'Signal', seriesLabel: 'MA', values: [null, null, 0.5] },
    { outputKey: 'marks', label: 'Marks', kind: 'markers' as const, values: [null, null, 1] },
  ],
}

const panes = [{ key: group.instanceKey, top: 100, height: 50, scale, group }]

describe('OscillatorHoverLayer', () => {
  it('reads each series at the hovered bar and shows the cursor value on the axis', () => {
    render(
      <svg>
        <OscillatorHoverLayer bar={bar} mouseY={125} panes={panes} left={8} innerWidth={700} />
      </svg>,
    )

    const readout = screen.getByTestId('oscillator-hover-readout')
    expect(readout.textContent).toBe('RSI 61.23   MA 0.5000')
    // y=125 sits halfway through a [0, 100] domain drawn between y=150 and y=100.
    expect(screen.getByTestId('oscillator-hover')).toHaveTextContent('50.00')
  })

  it('renders nothing when the cursor is outside every oscillator pane', () => {
    const { container } = render(
      <svg>
        <OscillatorHoverLayer bar={bar} mouseY={20} panes={panes} left={8} innerWidth={700} />
      </svg>,
    )

    expect(container.querySelector('[data-testid="oscillator-hover"]')).toBeNull()
  })
})
