import { render } from '@testing-library/react'
import { scaleBand, scaleLinear } from '@visx/scale'
import { describe, expect, it } from 'vitest'

import { CrosshairLayer } from '@/components/charts/layers/CrosshairLayer'
import type { ProcessedBar } from '@/components/charts/types/chart'
import { processBars } from '@/components/charts/hooks/useChartScales'
import type { OhlcvBar } from '@/types/api'

const BARS: OhlcvBar[] = [0, 1, 2].map((i) => ({
  timestamp: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
  open: 100,
  high: 102,
  low: 99,
  close: 101.123,
  volume: 10,
}))

const processed: ProcessedBar[] = processBars(BARS)

const layout = {
  priceTop: 10,
  priceHeight: 200,
  innerWidth: 300,
  stack: [
    { key: 'price', top: 10, height: 200 },
    { key: 'volume', top: 210, height: 40 },
    { key: 'rsi', top: 250, height: 60 },
  ],
}

function renderCrosshair(overrides: Partial<Parameters<typeof CrosshairLayer>[0]> = {}) {
  const xScale = scaleBand<string>({
    domain: processed.map((bar) => bar.timestamp),
    range: [0, layout.innerWidth],
    padding: 0.25,
  })
  const priceScale = scaleLinear<number>({ domain: [90, 110], range: [210, 10] })
  return render(
    <svg>
      <CrosshairLayer
        activeBar={processed[1]}
        xScale={xScale}
        priceScale={priceScale}
        layout={layout}
        timeframe="1H"
        left={8}
        width={400}
        mouseY={60}
        price={priceScale.invert(60)}
        digits={2}
        {...overrides}
      />
    </svg>,
  )
}

describe('CrosshairLayer', () => {
  it('spans the vertical line over every pane, down to the last oscillator', () => {
    const { container } = renderCrosshair()
    const vertical = container.querySelectorAll('line')[0]
    expect(vertical.getAttribute('y1')).toBe('10')
    expect(vertical.getAttribute('y2')).toBe('310')
  })

  it('labels the pointer price at the instrument precision, not the bar close', () => {
    const { getByTestId } = renderCrosshair()
    const label = getByTestId('crosshair-price-label')
    expect(label.textContent).toMatch(/^\d+\.\d{2}$/)
    expect(label.textContent).not.toBe('101.12')
    expect(label.textContent).toBe((110 - ((60 - 10) / 200) * 20).toFixed(2))
  })

  it('formats with zero, two or five digits', () => {
    for (const digits of [0, 2, 5]) {
      const { getByTestId, unmount } = renderCrosshair({
        price: 100.123456,
        digits,
      })
      expect(getByTestId('crosshair-price-label').textContent).toBe((100.123456).toFixed(digits))
      unmount()
    }
  })

  it('hides the horizontal line and label when the pointer is outside the price pane', () => {
    const { queryByTestId } = renderCrosshair({ mouseY: 230 })
    expect(queryByTestId('crosshair-price-line')).toBeNull()
    expect(queryByTestId('crosshair-price-label')).toBeNull()
  })
})
