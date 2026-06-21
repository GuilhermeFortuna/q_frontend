import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createRef, type ComponentProps } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CandlestickChart, type CandlestickChartHandle } from '@/components/charts/CandlestickChart'
import { sma } from '@/lib/indicators'
import type { OhlcvBar } from '@/types/api'
import type { IndicatorConfig } from '@/components/charts/types/chart'

vi.mock('@/lib/indicators', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/indicators')>()
  return {
    ...actual,
    sma: vi.fn(actual.sma),
  }
})

const mockBars: OhlcvBar[] = Array.from({ length: 30 }, (_, i) => {
  const close = 100 + i * 0.5
  return {
    timestamp: new Date(Date.UTC(2024, 5, i + 1)).toISOString(),
    open: close - 0.3,
    high: close + 0.8,
    low: close - 0.8,
    close,
    volume: 1_000_000 + i * 10_000,
  }
})

const smaIndicators: IndicatorConfig[] = [{ type: 'sma', enabled: true, period: 5 }]

function renderChart(props: Partial<ComponentProps<typeof CandlestickChart>> = {}) {
  return render(
    <div style={{ width: 800, height: 400 }}>
      <CandlestickChart
        data={mockBars}
        symbol="PETR4"
        timeframe="1D"
        indicators={smaIndicators}
        {...props}
      />
    </div>,
  )
}

async function waitForChartSvg() {
  await waitFor(() => expect(document.querySelector('svg')).toBeTruthy())
}

describe('CandlestickChart', () => {
  beforeEach(() => {
    vi.mocked(sma).mockClear()
  })

  afterEach(() => {
    vi.mocked(sma).mockClear()
  })

  it('renders empty state when no data', () => {
    render(<CandlestickChart data={[]} symbol="PETR4" />)
    expect(screen.getByText('No chart data available.')).toBeInTheDocument()
  })

  it('renders chart with mock OHLCV data', async () => {
    const { container } = render(
      <div style={{ width: 800, height: 400 }}>
        <CandlestickChart data={mockBars} symbol="PETR4" timeframe="1D" />
      </div>,
    )
    await waitFor(() => expect(container.querySelector('svg')).toBeTruthy())
    expect(screen.queryByLabelText('Go to latest candle')).not.toBeInTheDocument()
  })

  it('shows latest button when scrolled away from the end and jumps back on click', async () => {
    const user = userEvent.setup()
    const chartRef = createRef<CandlestickChartHandle>()
    const manyBars: OhlcvBar[] = Array.from({ length: 150 }, (_, i) => {
      const close = 100 + i * 0.5
      return {
        timestamp: new Date(Date.UTC(2024, 0, i + 1)).toISOString(),
        open: close - 0.3,
        high: close + 0.8,
        low: close - 0.8,
        close,
        volume: 1_000_000 + i * 10_000,
      }
    })

    render(
      <div style={{ width: 800, height: 400 }}>
        <CandlestickChart ref={chartRef} data={manyBars} symbol="PETR4" timeframe="1D" />
      </div>,
    )

    await waitFor(() => expect(chartRef.current).not.toBeNull())
    await waitFor(() => expect(document.querySelector('svg')).toBeTruthy())

    act(() => {
      chartRef.current!.panBy(-50)
    })

    const latestButton = await screen.findByLabelText('Go to latest candle')
    expect(latestButton).toBeInTheDocument()

    await user.click(latestButton)

    expect(screen.queryByLabelText('Go to latest candle')).not.toBeInTheDocument()
  })

  it('does not recompute indicators on mousemove when only hover changes', async () => {
    renderChart()
    await waitForChartSvg()

    await waitFor(() => {
      expect(vi.mocked(sma).mock.calls.length).toBeGreaterThan(0)
    })

    const callsAfterMount = vi.mocked(sma).mock.calls.length
    const overlay = document.querySelector('svg rect[fill="transparent"]')
    expect(overlay).toBeTruthy()

    fireEvent.mouseMove(overlay!, { clientX: 320, clientY: 180 })
    fireEvent.mouseMove(overlay!, { clientX: 360, clientY: 190 })
    fireEvent.mouseMove(overlay!, { clientX: 400, clientY: 200 })

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })

    expect(vi.mocked(sma).mock.calls.length).toBe(callsAfterMount)
  })

  it('recomputes indicators when data or indicator params change', async () => {
    const { rerender } = renderChart()
    await waitForChartSvg()

    await waitFor(() => {
      expect(vi.mocked(sma).mock.calls.length).toBeGreaterThan(0)
    })

    const callsAfterMount = vi.mocked(sma).mock.calls.length

    rerender(
      <div style={{ width: 800, height: 400 }}>
        <CandlestickChart
          data={mockBars}
          symbol="PETR4"
          timeframe="1D"
          indicators={[{ type: 'sma', enabled: true, period: 8 }]}
        />
      </div>,
    )

    await waitFor(() => {
      expect(vi.mocked(sma).mock.calls.length).toBeGreaterThan(callsAfterMount)
    })

    const callsAfterPeriodChange = vi.mocked(sma).mock.calls.length

    const extendedBars = [
      ...mockBars,
      {
        timestamp: new Date(Date.UTC(2024, 6, 1)).toISOString(),
        open: 115,
        high: 116,
        low: 114,
        close: 115.5,
        volume: 1_500_000,
      },
    ]

    rerender(
      <div style={{ width: 800, height: 400 }}>
        <CandlestickChart
          data={extendedBars}
          symbol="PETR4"
          timeframe="1D"
          indicators={[{ type: 'sma', enabled: true, period: 8 }]}
        />
      </div>,
    )

    await waitFor(() => {
      expect(vi.mocked(sma).mock.calls.length).toBeGreaterThan(callsAfterPeriodChange)
    })
  })

  it('keeps sma path output stable for a fixed dataset', async () => {
    renderChart()
    await waitForChartSvg()

    let pathD = ''
    await waitFor(() => {
      const path = Array.from(document.querySelectorAll('path')).find(
        (node) =>
          node.getAttribute('stroke-dasharray') === '5 3' &&
          Boolean(node.getAttribute('d')?.startsWith('M ')),
      )
      expect(path).toBeTruthy()
      pathD = path!.getAttribute('d')!
    })

    expect(pathD).toMatchSnapshot()
  })
})
