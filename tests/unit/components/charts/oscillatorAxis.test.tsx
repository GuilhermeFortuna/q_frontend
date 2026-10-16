import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { OscillatorAxisHandles } from '@/components/charts/layers/OscillatorAxisHandles'
import {
  applyOscillatorAxisScale,
  stretchScaleFactor,
} from '@/components/charts/hooks/useChartScales'
import { formatIndicatorValue } from '@/lib/market/format'

describe('applyOscillatorAxisScale', () => {
  it('keeps the domain when the factor is 1', () => {
    expect(applyOscillatorAxisScale([10, 30], 1)).toEqual([10, 30])
  })

  it('stretches around the centre of the domain', () => {
    const [min, max] = applyOscillatorAxisScale([10, 30], 2)
    expect(min).toBeCloseTo(0)
    expect(max).toBeCloseTo(40)
  })
})

describe('stretchScaleFactor', () => {
  it('grows the factor for a positive drag and shrinks it for a negative one', () => {
    expect(stretchScaleFactor(1, 10)).toBeGreaterThan(1)
    expect(stretchScaleFactor(1, -10)).toBeLessThan(1)
  })

  it('clamps to the price axis limits', () => {
    expect(stretchScaleFactor(1, 100_000)).toBeLessThanOrEqual(20)
    expect(stretchScaleFactor(1, -100_000)).toBeGreaterThanOrEqual(0.05)
  })
})

describe('formatIndicatorValue', () => {
  it('uses more digits for small values', () => {
    expect(formatIndicatorValue(0.001234)).toBe('0.0012')
    expect(formatIndicatorValue(4.5)).toBe('4.50')
    expect(formatIndicatorValue(250.25)).toBe('250.3')
  })
})

describe('OscillatorAxisHandles', () => {
  const oscillators = [{ key: 'rsi', top: 100, height: 50 }]
  const margins = { top: 0, right: 64, bottom: 0, left: 8 }

  it('reports vertical drags for the pane being dragged', () => {
    const onStretch = vi.fn()
    render(
      <svg>
        <OscillatorAxisHandles
          oscillators={oscillators}
          margins={margins}
          innerWidth={700}
          onStretch={onStretch}
          onReset={vi.fn()}
        />
      </svg>,
    )

    fireEvent.mouseDown(screen.getByTestId('oscillator-axis-rsi'), { button: 0, clientY: 120 })
    fireEvent.mouseMove(window, { clientY: 110 })
    fireEvent.mouseUp(window)

    expect(onStretch).toHaveBeenCalledWith('rsi', -10)
  })

  it('resets the pane on double-click', () => {
    const onReset = vi.fn()
    render(
      <svg>
        <OscillatorAxisHandles
          oscillators={oscillators}
          margins={margins}
          innerWidth={700}
          onStretch={vi.fn()}
          onReset={onReset}
        />
      </svg>,
    )

    fireEvent.doubleClick(screen.getByTestId('oscillator-axis-rsi'))

    expect(onReset).toHaveBeenCalledWith('rsi')
  })
})
