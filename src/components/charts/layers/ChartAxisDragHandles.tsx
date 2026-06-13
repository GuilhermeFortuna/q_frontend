import { useCallback, useEffect, useRef, useState } from 'react'

import type { ChartMargins } from '@/components/charts/types/chart'
import type { PaneLayout } from '@/components/charts/types/chart'

type AxisDragAxis = 'x' | 'y'

type ChartAxisDragHandlesProps = {
  width: number
  height: number
  margins: ChartMargins
  layout: Pick<PaneLayout, 'innerWidth' | 'priceTop' | 'priceHeight'>
  onStretchX: (deltaX: number) => void
  onStretchY: (deltaY: number) => void
  disabled?: boolean
}

export function ChartAxisDragHandles({
  width,
  height,
  margins,
  layout,
  onStretchX,
  onStretchY,
  disabled = false,
}: ChartAxisDragHandlesProps) {
  const [dragging, setDragging] = useState<AxisDragAxis | null>(null)
  const lastPoint = useRef({ x: 0, y: 0 })

  const startDrag = useCallback(
    (axis: AxisDragAxis, clientX: number, clientY: number) => {
      if (disabled) return
      setDragging(axis)
      lastPoint.current = { x: clientX, y: clientY }
    },
    [disabled],
  )

  useEffect(() => {
    if (!dragging) return undefined

    const onMouseMove = (event: MouseEvent) => {
      const deltaX = event.clientX - lastPoint.current.x
      const deltaY = event.clientY - lastPoint.current.y

      if (dragging === 'x' && deltaX !== 0) {
        onStretchX(deltaX)
        lastPoint.current = { x: event.clientX, y: event.clientY }
      }

      if (dragging === 'y' && deltaY !== 0) {
        onStretchY(deltaY)
        lastPoint.current = { x: event.clientX, y: event.clientY }
      }
    }

    const onMouseUp = () => {
      setDragging(null)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging, onStretchX, onStretchY])

  const xAxisTop = height - margins.bottom

  return (
    <>
      <rect
        x={margins.left + layout.innerWidth}
        y={layout.priceTop}
        width={Math.max(width - margins.left - layout.innerWidth, margins.right)}
        height={layout.priceHeight}
        fill="transparent"
        style={{ cursor: disabled ? 'default' : dragging === 'y' ? 'grabbing' : 'ns-resize' }}
        onMouseDown={(event) => {
          event.stopPropagation()
          startDrag('y', event.clientX, event.clientY)
        }}
      />
      <rect
        x={margins.left}
        y={xAxisTop}
        width={layout.innerWidth}
        height={Math.max(height - xAxisTop, margins.bottom)}
        fill="transparent"
        style={{ cursor: disabled ? 'default' : dragging === 'x' ? 'grabbing' : 'ew-resize' }}
        onMouseDown={(event) => {
          event.stopPropagation()
          startDrag('x', event.clientX, event.clientY)
        }}
      />
    </>
  )
}
