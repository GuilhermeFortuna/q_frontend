import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'

import { dropTarget, movePane, resizeBoundary } from '@/components/charts/paneLayout'
import type {
  ChartMargins,
  OscillatorPaneSlot,
  PaneLayout,
  PaneLayoutPrefs,
} from '@/components/charts/types/chart'
import { chartTheme } from '@/lib/charts/chartTheme'

const RESIZE_STRIP_PX = 6
const GHOST_FILL = 'rgba(214, 178, 120, 0.12)'

type ResizeDrag = {
  kind: 'resize'
  boundary: number
  startY: number
  stack: OscillatorPaneSlot[]
  prefs: PaneLayoutPrefs
}

type MoveDrag = {
  kind: 'move'
  key: string
  startY: number
  stack: OscillatorPaneSlot[]
  prefs: PaneLayoutPrefs
}

type Drag = ResizeDrag | MoveDrag

type MoveState = {
  key: string
  dy: number
  index: number
  lineY: number
}

type OscillatorPaneHandlesProps = {
  layout: Pick<PaneLayout, 'stack' | 'oscillators' | 'innerWidth' | 'innerHeight'>
  margins: ChartMargins
  prefs: PaneLayoutPrefs
  /** Live layout while a drag is in progress; `null` clears the preview. */
  onPreview: (prefs: PaneLayoutPrefs | null) => void
  onCommit: (prefs: PaneLayoutPrefs) => void
  disabled?: boolean
}

/**
 * Pane resize and reorder for the oscillator stack. Dragging an oscillator's top
 * edge resizes it against its neighbour above; holding Ctrl and dragging a pane
 * body moves that pane to a new position in the stack. Escape cancels a move.
 */
export function OscillatorPaneHandles({
  layout,
  margins,
  prefs,
  onPreview,
  onCommit,
  disabled = false,
}: OscillatorPaneHandlesProps) {
  const [ctrlHeld, setCtrlHeld] = useState(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [move, setMove] = useState<MoveState | null>(null)
  const pending = useRef<PaneLayoutPrefs | null>(null)

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Control') setCtrlHeld(true)
      if (event.key === 'Escape' && drag?.kind === 'move') {
        pending.current = null
        setDrag(null)
        setMove(null)
        onPreview(null)
      }
    }
    const up = (event: KeyboardEvent) => {
      if (event.key === 'Control') setCtrlHeld(false)
    }
    const blur = () => setCtrlHeld(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [drag, onPreview])

  const startResize = useCallback(
    (boundary: number, event: ReactMouseEvent) => {
      if (disabled || event.button !== 0) return
      event.preventDefault()
      setDrag({
        kind: 'resize',
        boundary,
        startY: event.clientY,
        stack: layout.stack,
        prefs,
      })
    },
    [disabled, layout.stack, prefs],
  )

  const startMove = useCallback(
    (key: string, event: ReactMouseEvent) => {
      if (disabled || event.button !== 0 || !event.ctrlKey) return
      event.preventDefault()
      setDrag({ kind: 'move', key, startY: event.clientY, stack: layout.stack, prefs })
      setMove({ key, dy: 0, index: -1, lineY: 0 })
    },
    [disabled, layout.stack, prefs],
  )

  useEffect(() => {
    if (!drag) return

    const handleMove = (event: MouseEvent) => {
      const dy = event.clientY - drag.startY
      if (drag.kind === 'resize') {
        const heights = resizeBoundary(
          drag.stack,
          layout.innerHeight,
          drag.boundary,
          dy,
          drag.prefs.heights,
        )
        const next = { ...drag.prefs, heights }
        pending.current = next
        onPreview(next)
        return
      }
      const slot = drag.stack.find((item) => item.key === drag.key)
      if (!slot) return
      const target = dropTarget(drag.stack, drag.key, slot.top + slot.height / 2 + dy)
      setMove({ key: drag.key, dy, index: target.index, lineY: target.lineY })
    }

    const handleUp = () => {
      if (drag.kind === 'resize') {
        if (pending.current) onCommit(pending.current)
      } else if (move && move.index >= 0) {
        const order = movePane(
          drag.stack.map((item) => item.key),
          drag.key,
          move.index,
        )
        onCommit({ ...drag.prefs, order })
      }
      pending.current = null
      setDrag(null)
      setMove(null)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [drag, move, layout.innerHeight, onPreview, onCommit])

  const oscillatorSlots = layout.oscillators
  const movingSlot = move ? oscillatorSlots.find((slot) => slot.key === move.key) : null
  const left = margins.left
  const width = layout.innerWidth

  return (
    <g data-testid="oscillator-pane-handles">
      {!disabled &&
        layout.stack.map((slot, index) => {
          if (index === 0 || slot.key === 'price' || slot.key === 'volume') return null
          return (
            <rect
              key={`resize-${slot.key}`}
              data-testid={`pane-resize-${slot.key}`}
              x={left}
              y={slot.top - RESIZE_STRIP_PX / 2}
              width={width}
              height={RESIZE_STRIP_PX}
              fill="transparent"
              style={{ cursor: 'ns-resize' }}
              onMouseDown={(event) => startResize(index, event)}
            />
          )
        })}

      {!disabled &&
        oscillatorSlots.map((slot) => (
          <rect
            key={`move-${slot.key}`}
            data-testid={`pane-move-${slot.key}`}
            x={left}
            y={slot.top}
            width={width}
            height={slot.height}
            fill="transparent"
            style={{
              pointerEvents: ctrlHeld ? 'auto' : 'none',
              cursor: ctrlHeld ? 'grab' : undefined,
            }}
            onMouseDown={(event) => startMove(slot.key, event)}
          />
        ))}

      {movingSlot && move && drag?.kind === 'move' && (
        <>
          <rect
            x={left}
            y={movingSlot.top + move.dy}
            width={width}
            height={movingSlot.height}
            fill={GHOST_FILL}
            stroke={chartTheme.crosshair.stroke}
            strokeDasharray={chartTheme.crosshair.strokeDasharray}
            pointerEvents="none"
          />
          {move.index >= 0 && (
            <line
              x1={left}
              x2={left + width}
              y1={move.lineY}
              y2={move.lineY}
              stroke={chartTheme.baseline.stroke}
              strokeWidth={2}
              pointerEvents="none"
            />
          )}
        </>
      )}
    </g>
  )
}
