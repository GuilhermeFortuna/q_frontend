import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { scaleBand, scaleLinear } from '@visx/scale'

import { VolumeProfileLayer } from '@/components/charts/layers/VolumeProfileLayer'
import type { ProcessedBar } from '@/components/charts/types/chart'
import type { MarketVolumeProfileSegment } from '../../../contracts/api'

function bar(timestamp: string, close: number, index: number): ProcessedBar {
  return {
    timestamp,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
    index,
    timeMs: Date.parse(timestamp),
    isBullish: true,
    color: '#26a69a',
  }
}

const bars: ProcessedBar[] = [
  bar('2024-06-01T15:00:00.000Z', 100, 0),
  bar('2024-06-01T16:00:00.000Z', 101, 1),
  bar('2024-06-02T15:00:00.000Z', 102, 2),
]

const segment: MarketVolumeProfileSegment = {
  start: '2024-06-01T15:00:00.000Z',
  end: '2024-06-01T16:00:00.000Z',
  total: 900,
  buy: 500,
  sell: 350,
  unknown: 50,
  trades: 10,
  poc: 101,
  vah: 102,
  val: 100,
  rows: {
    price: [99, 100, 101, 102, 103],
    buy: [10, 40, 200, 30, 10],
    sell: [10, 30, 50, 80, 20],
    unknown: [0, 5, 5, 0, 5],
  },
}

function renderLayer(
  props: Partial<ComponentProps<typeof VolumeProfileLayer>> & {
    segmentMode: 'session' | 'visibleRange'
    narrowDomain?: boolean
  },
) {
  const xScale = scaleBand<string>({
    domain: bars.map((b) => b.timestamp),
    range: [0, 400],
    padding: 0.25,
  })
  const priceScale = scaleLinear<number>({
    domain: props.narrowDomain ? [100, 102] : [98, 104],
    range: [300, 20],
  })
  const { narrowDomain: _narrow, ...layerProps } = props
  return render(
    <svg width={500} height={400}>
      <VolumeProfileLayer
        segments={[segment]}
        allBars={bars}
        visibleBars={bars.slice(0, 2)}
        xScale={xScale}
        yScale={priceScale}
        left={8}
        innerWidth={400}
        priceTop={12}
        priceHeight={280}
        widthPercent={25}
        splitBuySell={true}
        rowSize={0.01}
        {...layerProps}
      />
    </svg>,
  )
}

describe('VolumeProfileLayer', () => {
  it('renders session profile rows and POC marker inside the price pane', () => {
    const { container } = renderLayer({ segmentMode: 'session' })
    expect(container.querySelector('[data-testid="volume-profile-layer"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="volume-profile-poc-row"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="volume-profile-level-poc"]')).toBeTruthy()
  })

  it('renders visible-range profile docked on the right', () => {
    const { container } = renderLayer({ segmentMode: 'visibleRange' })
    const layer = container.querySelector('[data-testid="volume-profile-layer"]')
    expect(layer).toBeTruthy()
    const rects = container.querySelectorAll('rect[fill^="rgba"]')
    expect(rects.length).toBeGreaterThan(0)
    const rightmost = [...rects].reduce((max, rect) => {
      const x = Number(rect.getAttribute('x') ?? 0)
      const width = Number(rect.getAttribute('width') ?? 0)
      return Math.max(max, x + width)
    }, 0)
    expect(rightmost).toBeGreaterThan(300)
  })

  it('culls rows outside the visible price scale domain', () => {
    const { container } = renderLayer({ segmentMode: 'session', narrowDomain: true })
    const rowRects = container.querySelectorAll('rect[fill="rgba(38, 166, 154, 0.55)"]')
    expect(rowRects.length).toBeLessThan(segment.rows.price.length)
  })
})

it('keeps session width when the session endpoints are outside the viewport', () => {
  const sessionBars = Array.from({ length: 10 }, (_, i) =>
    bar(`2024-06-01T${String(10 + i).padStart(2, '0')}:00:00.000Z`, 100, i),
  )
  const visible = sessionBars.slice(3, 7)
  const xScale = scaleBand<string>({
    domain: visible.map((b) => b.timestamp),
    range: [0, 400],
    padding: 0.25,
  })
  const { container } = renderLayer({
    segmentMode: 'session',
    allBars: sessionBars,
    visibleBars: visible,
    xScale,
    splitBuySell: false,
  })
  const poc = container.querySelector('[data-testid="volume-profile-poc-row"]')!
  expect(Number(poc.getAttribute('width'))).toBe(100)
})
