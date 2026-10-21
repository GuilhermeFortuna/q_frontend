import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { CandlestickChart } from '@/components/charts/CandlestickChart'
import type { OhlcvBar } from '@/types/api'

vi.mock('@visx/responsive', () => ({
  ParentSize: ({ children }: { children: (args: { width: number; height: number }) => unknown }) =>
    children({ width: 800, height: 400 }),
}))

function barsWithDecimals(decimals: number): OhlcvBar[] {
  return Array.from({ length: 30 }, (_, i) => ({
    timestamp: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
    open: Number((100 + i + 0.123456).toFixed(decimals)),
    high: Number((103 + i + 0.123456).toFixed(decimals)),
    low: Number((98 + i + 0.123456).toFixed(decimals)),
    close: Number((101 + i + 0.123456).toFixed(decimals)),
    volume: 1000,
  }))
}

function renderChart(
  props: Partial<React.ComponentProps<typeof CandlestickChart>> = {},
  bars = barsWithDecimals(2),
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CandlestickChart data={bars} symbol="WDO" timeframe="1H" {...props} />
    </QueryClientProvider>,
  )
  return screen.getByTestId('chart-interaction')
}

// Hover updates are coalesced into the next animation frame, so wait for the label to change.
async function hoverAt(surface: HTMLElement, clientY: number, previous = '') {
  fireEvent.mouseMove(surface, { clientX: 300, clientY })
  await waitFor(() => {
    const label = screen.queryByTestId('crosshair-price-label')?.textContent ?? ''
    expect(label).not.toBe(previous)
    expect(label).not.toBe('')
  })
  return screen.getByTestId('crosshair-price-label').textContent ?? ''
}

describe('CandlestickChart crosshair', () => {
  it('labels the price under the pointer with the instrument precision, not the bar close', async () => {
    const surface = renderChart({ priceFormat: { digits: 2, tickSize: 0.01 } })
    const label = await hoverAt(surface, 120)
    expect(label).toMatch(/^\d+\.\d{2}$/)
    const higher = await hoverAt(surface, 60, label)
    expect(Number(higher)).toBeGreaterThan(Number(label))
  })

  it.each([0, 2, 5])('formats the pointer label with %i digits', async (digits) => {
    const surface = renderChart({ priceFormat: { digits, tickSize: 10 ** -digits } })
    const label = await hoverAt(surface, 120)
    const decimals = label.split('.')[1]?.length ?? 0
    expect(decimals).toBe(digits)
  })

  it('keeps the crosshair visible while a drawing tool is armed', async () => {
    const surface = renderChart({ activeDrawingTool: 'trendline' })
    await hoverAt(surface, 120)
    expect(screen.getByTestId('crosshair-price-label')).toBeInTheDocument()
  })

  it('infers the precision from the bars when no instrument format is given', async () => {
    const surface = renderChart({}, barsWithDecimals(3))
    const label = await hoverAt(surface, 120)
    expect(label.split('.')[1]?.length).toBe(3)
  })

  it('draws a last-price line at the latest close', () => {
    renderChart({ priceFormat: { digits: 2, tickSize: 0.01 } })
    expect(screen.getByTestId('last-price')).toHaveTextContent(/\d+\.\d{2}/)
  })
})
