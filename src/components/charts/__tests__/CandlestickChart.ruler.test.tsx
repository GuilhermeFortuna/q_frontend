import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { CandlestickChart } from '@/components/charts/CandlestickChart'
import type { OhlcvBar } from '@/types/api'

vi.mock('@visx/responsive', () => ({
  ParentSize: ({ children }: { children: (args: { width: number; height: number }) => unknown }) =>
    children({ width: 800, height: 400 }),
}))

const BARS: OhlcvBar[] = Array.from({ length: 30 }, (_, i) => ({
  timestamp: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
  open: 100 + i,
  high: 103 + i,
  low: 98 + i,
  close: 101 + i,
  volume: 1000,
}))

function renderChart() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CandlestickChart data={BARS} symbol="WDO" timeframe="1H" />
    </QueryClientProvider>,
  )
  const chart = screen.getByTestId('chart-interaction').closest('[tabindex="0"]') as HTMLElement
  chart.focus()
  return { chart, surface: screen.getByTestId('chart-interaction') }
}

describe('CandlestickChart ruler', () => {
  it('starts in hand mode and switches to ruler on Ctrl while the chart is focused', () => {
    const { chart } = renderChart()

    expect(screen.getByTestId('chart-measure-mode')).toHaveTextContent('Hand · Ctrl')

    fireEvent.keyDown(chart, { key: 'Control' })
    expect(screen.getByTestId('chart-measure-mode')).toHaveTextContent('Ruler · Ctrl')

    fireEvent.keyDown(chart, { key: 'Control' })
    expect(screen.getByTestId('chart-measure-mode')).toHaveTextContent('Hand · Ctrl')
  })

  it('draws a measurement while dragging in ruler mode and clears it on Escape', () => {
    const { chart, surface } = renderChart()
    fireEvent.keyDown(chart, { key: 'Control' })

    fireEvent.mouseDown(surface, { button: 0, clientX: 100, clientY: 60 })
    fireEvent.mouseMove(surface, { clientX: 260, clientY: 140 })
    fireEvent.mouseUp(surface, { button: 0, clientX: 260, clientY: 140 })

    expect(screen.getByTestId('chart-ruler')).toBeInTheDocument()
    expect(screen.getByTestId('chart-ruler-span')).toHaveTextContent(/bars ·/)

    fireEvent.keyDown(chart, { key: 'Escape' })
    expect(screen.queryByTestId('chart-ruler')).toBeNull()
  })

  it('treats a press without movement in ruler mode as a click that clears the ruler', () => {
    const { chart, surface } = renderChart()
    fireEvent.keyDown(chart, { key: 'Control' })

    fireEvent.mouseDown(surface, { button: 0, clientX: 100, clientY: 60 })
    fireEvent.mouseMove(surface, { clientX: 220, clientY: 90 })
    fireEvent.mouseUp(surface, { button: 0, clientX: 220, clientY: 90 })
    expect(screen.getByTestId('chart-ruler')).toBeInTheDocument()

    fireEvent.mouseDown(surface, { button: 0, clientX: 150, clientY: 80 })
    fireEvent.mouseUp(surface, { button: 0, clientX: 150, clientY: 80 })
    expect(screen.queryByTestId('chart-ruler')).toBeNull()
  })

  it('does not measure in hand mode', () => {
    const { surface } = renderChart()

    fireEvent.mouseDown(surface, { button: 0, clientX: 100, clientY: 60 })
    fireEvent.mouseMove(surface, { clientX: 260, clientY: 140 })
    fireEvent.mouseUp(surface, { button: 0, clientX: 260, clientY: 140 })

    expect(screen.queryByTestId('chart-ruler')).toBeNull()
  })
})
