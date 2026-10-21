import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DrawingToolbar, toolbarPosition } from '@/components/charts/DrawingToolbar'
import { TextNoteEditor } from '@/components/charts/TextNoteEditor'
import type { DrawingObject } from '@/components/charts/drawings/model'

const style = { color: '#c9a227', width: 1 as const, lineStyle: 'solid' as const }

function fibDrawing(levels: number[]): DrawingObject {
  return {
    id: 'f',
    type: 'fib',
    anchors: [
      { time: 0, price: 100 },
      { time: 1, price: 110 },
    ],
    style,
    locked: false,
    hidden: false,
    options: { levels, extendRight: true },
  }
}

describe('DrawingToolbar', () => {
  it('applies a colour change as a whole-drawing update', () => {
    const onUpdate = vi.fn()
    render(
      <DrawingToolbar
        drawing={fibDrawing([0, 1])}
        handles={[{ x: 100, y: 100 }]}
        containerWidth={800}
        containerHeight={400}
        onUpdate={onUpdate}
        onToggleHidden={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Colour #26a69a' }))
    const update = onUpdate.mock.calls[0][0] as (drawing: DrawingObject) => DrawingObject
    expect(update(fibDrawing([0, 1])).style.color).toBe('#26a69a')
  })

  it('toggles a Fibonacci level on and off in the drawing options', () => {
    const onUpdate = vi.fn()
    render(
      <DrawingToolbar
        drawing={fibDrawing([0, 1])}
        handles={[{ x: 100, y: 100 }]}
        containerWidth={800}
        containerHeight={400}
        onUpdate={onUpdate}
        onToggleHidden={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Level 61.8 percent' }))
    const update = onUpdate.mock.calls[0][0] as (drawing: DrawingObject) => DrawingObject
    const next = update(fibDrawing([0, 1]))
    expect(next.type === 'fib' && next.options.levels).toEqual([0, 0.618, 1])
  })

  it('deletes and hides the selected drawing through its buttons', () => {
    const onDelete = vi.fn()
    const onToggleHidden = vi.fn()
    render(
      <DrawingToolbar
        drawing={fibDrawing([0])}
        handles={[{ x: 100, y: 100 }]}
        containerWidth={800}
        containerHeight={400}
        onUpdate={vi.fn()}
        onToggleHidden={onToggleHidden}
        onDelete={onDelete}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete drawing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hide drawing' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onToggleHidden).toHaveBeenCalledTimes(1)
  })
})

describe('toolbarPosition', () => {
  it('sits above the anchors when there is room', () => {
    expect(toolbarPosition([{ x: 300, y: 200 }], 800, 400).top).toBe(200 - 34 - 6)
  })

  it('drops below the anchors when they are at the top of the chart', () => {
    expect(toolbarPosition([{ x: 300, y: 20 }], 800, 400).top).toBe(26)
  })

  it('stays inside the chart horizontally', () => {
    expect(toolbarPosition([{ x: 790, y: 200 }], 800, 400).left).toBe(800 - 340 - 6)
  })
})

describe('TextNoteEditor', () => {
  it('commits on Enter, keeps Shift+Enter for a new line, and cancels on Escape', () => {
    const onCommit = vi.fn()
    const onCancel = vi.fn()
    render(<TextNoteEditor x={10} y={20} initialText="" onCommit={onCommit} onCancel={onCancel} />)
    const field = screen.getByTestId('text-note-editor')
    fireEvent.change(field, { target: { value: 'breakout' } })
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true })
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledWith('breakout')
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('cancels on Escape and does not also commit when the field then loses focus', () => {
    const onCommit = vi.fn()
    const onCancel = vi.fn()
    render(
      <TextNoteEditor x={10} y={20} initialText="keep" onCommit={onCommit} onCancel={onCancel} />,
    )
    const field = screen.getByTestId('text-note-editor')
    fireEvent.keyDown(field, { key: 'Escape' })
    fireEvent.blur(field)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onCommit).not.toHaveBeenCalled()
  })
})
