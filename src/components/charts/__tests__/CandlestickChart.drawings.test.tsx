import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { CandlestickChart } from '@/components/charts/CandlestickChart'
import type { DrawingObject, DrawingTool } from '@/components/charts/drawings/model'
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

const LINE_STYLE = { color: '#c9a227', width: 1 as const, lineStyle: 'solid' as const }

function horizontal(id: string, price: number, extra: Partial<DrawingObject> = {}): DrawingObject {
  return {
    id,
    type: 'hline',
    anchors: [{ time: Date.parse(BARS[10].timestamp), price }],
    style: LINE_STYLE,
    locked: false,
    hidden: false,
    options: {},
    ...extra,
  } as DrawingObject
}

type HarnessProps = {
  initial?: DrawingObject[]
  tool?: DrawingTool
  onChange?: (next: DrawingObject[]) => void
  onUndo?: () => void
  onRedo?: () => void
  onViewport?: () => void
  hideAll?: boolean
  keepTool?: boolean
}

/** A stateful host, so the chart's commits are visible to it the way the workspace is. */
function Harness({
  initial = [],
  tool = 'cursor',
  onChange,
  onUndo,
  onRedo,
  onViewport,
  hideAll,
  keepTool,
}: HarnessProps) {
  const [drawings, setDrawings] = useState<DrawingObject[]>(initial)
  const [active, setActive] = useState<DrawingTool>(tool)
  return (
    <CandlestickChart
      data={BARS}
      symbol="WDO"
      timeframe="1H"
      activeDrawingTool={active}
      onActiveDrawingToolChange={setActive}
      drawings={drawings}
      onDrawingsChange={(next) => {
        onChange?.(next)
        setDrawings(next)
      }}
      onUndoDrawings={onUndo}
      onRedoDrawings={onRedo}
      onViewportChange={onViewport}
      hideAllDrawings={hideAll}
      keepDrawingTool={keepTool}
      priceFormat={{ digits: 2, tickSize: 0.01 }}
    />
  )
}

function renderHarness(props: HarnessProps = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <Harness {...props} />
    </QueryClientProvider>,
  )
  const surface = screen.getByTestId('chart-interaction')
  const chart = surface.closest('[tabindex="0"]') as HTMLElement
  chart.focus()
  return { surface, chart }
}

function press(surface: HTMLElement, x: number, y: number) {
  fireEvent.mouseDown(surface, { button: 0, clientX: x, clientY: y })
  fireEvent.mouseUp(surface, { button: 0, clientX: x, clientY: y })
}

function drawingElements() {
  return Array.from(document.querySelectorAll('[data-drawing-id]'))
}

describe('CandlestickChart drawings', () => {
  it('places a horizontal line with one click and returns the tool to the cursor', () => {
    const onChange = vi.fn()
    const { surface } = renderHarness({ tool: 'hline', onChange })

    press(surface, 300, 200)

    expect(onChange).toHaveBeenCalledTimes(1)
    const [[next]] = onChange.mock.calls as [[DrawingObject[]]]
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ type: 'hline', options: {} })
    expect(drawingElements()).toHaveLength(1)
    expect(screen.getByTestId('drawing-handles')).toBeInTheDocument()
    expect(screen.getByTestId('chart-measure-mode')).toBeInTheDocument()
  })

  it('places a trend line with two clicks and stores it in epoch time', () => {
    const onChange = vi.fn()
    const { surface } = renderHarness({ tool: 'trendline', onChange })

    press(surface, 200, 150)
    expect(onChange).not.toHaveBeenCalled()
    press(surface, 500, 250)

    expect(onChange).toHaveBeenCalledTimes(1)
    const [[next]] = onChange.mock.calls as [[DrawingObject[]]]
    expect(next[0].type).toBe('trendline')
    expect(next[0].anchors).toHaveLength(2)
    expect(next[0].anchors[0].time).toBeGreaterThan(Date.UTC(2025, 0, 1))
    expect(next[0].anchors[1].time).toBeGreaterThan(next[0].anchors[0].time)
    expect(next[0].anchors[1].price).toBeLessThan(next[0].anchors[0].price)
  })

  it('places a trend line by press, drag and release', () => {
    const onChange = vi.fn()
    const { surface } = renderHarness({ tool: 'trendline', onChange })

    fireEvent.mouseDown(surface, { button: 0, clientX: 200, clientY: 150 })
    fireEvent.mouseMove(surface, { clientX: 350, clientY: 180 })
    fireEvent.mouseMove(surface, { clientX: 500, clientY: 250 })
    fireEvent.mouseUp(surface, { button: 0, clientX: 500, clientY: 250 })

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('constrains the second anchor of a trend line to horizontal with Shift', () => {
    const onChange = vi.fn()
    const { surface } = renderHarness({ tool: 'trendline', onChange })

    press(surface, 200, 150)
    fireEvent.mouseDown(surface, { button: 0, clientX: 500, clientY: 250, shiftKey: true })
    fireEvent.mouseUp(surface, { button: 0, clientX: 500, clientY: 250, shiftKey: true })

    const [[next]] = onChange.mock.calls as [[DrawingObject[]]]
    expect(next[0].anchors[1].price).toBe(next[0].anchors[0].price)
  })

  it('cancels an unfinished placement with Escape', () => {
    const onChange = vi.fn()
    const { surface, chart } = renderHarness({ tool: 'trendline', onChange })

    press(surface, 200, 150)
    fireEvent.keyDown(chart, { key: 'Escape' })
    press(surface, 500, 250)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('selects a drawing on click, shows its handles and deletes it with the Delete key', () => {
    const onChange = vi.fn()
    const { surface, chart } = renderHarness({ initial: [horizontal('h1', 105)], onChange })

    expect(screen.queryByTestId('drawing-handles')).toBeNull()
    const y = drawingLineY()
    press(surface, 600, y)
    expect(screen.getByTestId('drawing-handles')).toBeInTheDocument()

    fireEvent.keyDown(chart, { key: 'Delete' })
    expect(onChange).toHaveBeenCalledWith([])
    expect(drawingElements()).toHaveLength(0)
  })

  it('moves a selected line when its body is dragged, committing once on release', () => {
    const onChange = vi.fn()
    const { surface } = renderHarness({ initial: [horizontal('h1', 105)], onChange })
    const y = drawingLineY()
    press(surface, 600, y)

    fireEvent.mouseDown(surface, { button: 0, clientX: 600, clientY: y })
    fireEvent.mouseMove(surface, { clientX: 600, clientY: y + 20 })
    fireEvent.mouseMove(surface, { clientX: 600, clientY: y + 40 })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.mouseUp(surface, { button: 0, clientX: 600, clientY: y + 40 })

    expect(onChange).toHaveBeenCalledTimes(1)
    const [[next]] = onChange.mock.calls as [[DrawingObject[]]]
    expect(next[0].anchors[0].price).toBeLessThan(105)
  })

  it('restores the drawing when Escape is pressed during a drag', () => {
    const onChange = vi.fn()
    const { surface, chart } = renderHarness({ initial: [horizontal('h1', 105)], onChange })
    const y = drawingLineY()
    press(surface, 600, y)

    fireEvent.mouseDown(surface, { button: 0, clientX: 600, clientY: y })
    fireEvent.mouseMove(surface, { clientX: 600, clientY: y + 60 })
    fireEvent.keyDown(chart, { key: 'Escape' })
    fireEvent.mouseUp(surface, { button: 0, clientX: 600, clientY: y + 60 })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not move a locked drawing but still selects it', () => {
    const onChange = vi.fn()
    const { surface } = renderHarness({
      initial: [horizontal('h1', 105, { locked: true })],
      onChange,
    })
    const y = drawingLineY()

    fireEvent.mouseDown(surface, { button: 0, clientX: 600, clientY: y })
    fireEvent.mouseMove(surface, { clientX: 600, clientY: y + 40 })
    fireEvent.mouseUp(surface, { button: 0, clientX: 600, clientY: y + 40 })

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByTestId('drawing-handles')).toHaveAttribute('data-locked', 'true')
  })

  it('does not pan the chart when the press lands on a drawing', () => {
    const onViewport = vi.fn()
    const { surface } = renderHarness({ initial: [horizontal('h1', 105)], onViewport })
    const y = drawingLineY()
    const before = onViewport.mock.calls.length

    fireEvent.mouseDown(surface, { button: 0, clientX: 600, clientY: y })
    fireEvent.mouseMove(surface, { clientX: 500, clientY: y })
    fireEvent.mouseUp(surface, { button: 0, clientX: 500, clientY: y })

    expect(onViewport.mock.calls.length).toBe(before)
  })

  it('hides drawings with Hide all without changing their own flags', () => {
    renderHarness({ initial: [horizontal('h1', 105)], hideAll: true })
    expect(drawingElements()).toHaveLength(0)
  })

  it('does not render a drawing that is hidden on its own', () => {
    renderHarness({ initial: [horizontal('h1', 105, { hidden: true })] })
    expect(drawingElements()).toHaveLength(0)
  })

  it('routes Ctrl+Z and Ctrl+Shift+Z to undo and redo without toggling the ruler', () => {
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    const { chart } = renderHarness({ onUndo, onRedo })

    fireEvent.keyDown(chart, { key: 'Control', ctrlKey: true })
    fireEvent.keyDown(chart, { key: 'z', ctrlKey: true })
    fireEvent.keyUp(chart, { key: 'z', ctrlKey: true })
    fireEvent.keyUp(chart, { key: 'Control' })
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('chart-measure-mode')).toHaveTextContent('Hand · Ctrl')

    fireEvent.keyDown(chart, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(onRedo).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(chart, { key: 'y', ctrlKey: true })
    expect(onRedo).toHaveBeenCalledTimes(2)
  })

  it('keeps the placement tool armed with Keep drawing', () => {
    const onChange = vi.fn()
    const { surface } = renderHarness({ tool: 'hline', keepTool: true, onChange })

    press(surface, 300, 200)
    press(surface, 300, 260)

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(drawingElements()).toHaveLength(2)
  })
})

/** Chart y of the first drawn horizontal line, from the placed drawing's segment. */
function drawingLineY(): number {
  const line = document.querySelector('[data-drawing-type="hline"] line')
  if (!line) throw new Error('no horizontal line rendered')
  return Number(line.getAttribute('y1'))
}
