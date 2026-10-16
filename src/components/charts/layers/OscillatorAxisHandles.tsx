import { useEffect, useRef, useState } from 'react'

import type { ChartMargins, OscillatorPaneSlot } from '@/components/charts/types/chart'

type OscillatorAxisHandlesProps = {
  oscillators: OscillatorPaneSlot[]
  margins: ChartMargins
  innerWidth: number
  onStretch: (key: string, deltaY: number) => void
  onReset: (key: string) => void
  disabled?: boolean
}

/**
 * Drag strips over each oscillator's right-hand axis. Dragging stretches that
 * pane's value axis, the same way the price axis is stretched; double-click
 * restores it.
 */
export function OscillatorAxisHandles({
  oscillators,
  margins,
  innerWidth,
  onStretch,
  onReset,
  disabled = false,
}: OscillatorAxisHandlesProps) {
  const [dragging, setDragging] = useState<string | null>(null)
  const lastY = useRef(0)

  useEffect(() => {
    if (!dragging) return undefined

    const onMouseMove = (event: MouseEvent) => {
      const deltaY = event.clientY - lastY.current
      if (deltaY === 0) return
      onStretch(dragging, deltaY)
      lastY.current = event.clientY
    }
    const onMouseUp = () => setDragging(null)

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging, onStretch])

  return (
    <g>
      {oscillators.map((slot) => (
        <rect
          key={`axis-${slot.key}`}
          data-testid={`oscillator-axis-${slot.key}`}
          x={margins.left + innerWidth}
          y={slot.top}
          width={margins.right}
          height={slot.height}
          fill="transparent"
          style={{
            cursor: disabled ? 'default' : dragging === slot.key ? 'grabbing' : 'ns-resize',
          }}
          onMouseDown={(event) => {
            if (disabled) return
            event.stopPropagation()
            lastY.current = event.clientY
            setDragging(slot.key)
          }}
          onDoubleClick={(event) => {
            if (disabled) return
            event.stopPropagation()
            onReset(slot.key)
          }}
        />
      ))}
    </g>
  )
}
