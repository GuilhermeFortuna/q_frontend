import type { ReactNode } from 'react'
import { EyeOff, Lock, LockOpen, Trash2 } from 'lucide-react'

import {
  DRAWING_LINE_STYLES,
  DRAWING_WIDTHS,
  FIB_EXTENSION_LEVELS,
  FIB_RETRACEMENT_LEVELS,
  type DrawingLineStyle,
  type DrawingObject,
} from '@/components/charts/drawings/model'
import type { Point } from '@/components/charts/drawings/geometry'
import { cn } from '@/lib/utils'

export const DRAWING_SWATCHES = [
  '#c9a227',
  '#26a69a',
  '#ef5350',
  '#6eb5ff',
  '#a78bfa',
  '#e5e7eb',
] as const

const TOOLBAR_WIDTH = 340
const TOOLBAR_HEIGHT = 34
const EDGE_GAP = 6
const LEVEL_NAMES: Record<number, string> = {
  0: '0',
  0.236: '23.6',
  0.382: '38.2',
  0.5: '50',
  0.618: '61.8',
  0.786: '78.6',
  1: '100',
  1.618: '161.8',
  2.618: '261.8',
}

export type DrawingToolbarProps = {
  drawing: DrawingObject
  /** Anchor positions of the drawing in chart coordinates. */
  handles: Point[]
  containerWidth: number
  containerHeight: number
  onUpdate: (update: (drawing: DrawingObject) => DrawingObject) => void
  onToggleHidden: () => void
  onDelete: () => void
}

/** Floating style toolbar for the selected drawing. It sits above or below the anchors, never over them. */
export function DrawingToolbar({
  drawing,
  handles,
  containerWidth,
  containerHeight,
  onUpdate,
  onToggleHidden,
  onDelete,
}: DrawingToolbarProps) {
  const position = toolbarPosition(handles, containerWidth, containerHeight)
  const setStyle = (patch: Partial<DrawingObject['style']>) =>
    onUpdate((current) => ({ ...current, style: { ...current.style, ...patch } }) as DrawingObject)
  const setOptions = (patch: Record<string, unknown>) =>
    onUpdate(
      (current) => ({ ...current, options: { ...current.options, ...patch } }) as DrawingObject,
    )

  return (
    <div
      role="toolbar"
      aria-label="Drawing style"
      data-testid="drawing-toolbar"
      className="surface-float absolute z-20 flex flex-wrap items-center gap-1.5 rounded-md px-2 py-1"
      style={{ left: position.left, top: position.top, width: TOOLBAR_WIDTH }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-1" role="group" aria-label="Colour">
        {DRAWING_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Colour ${color}`}
            aria-pressed={drawing.style.color === color}
            onClick={() => setStyle({ color })}
            className={cn(
              'h-3.5 w-3.5 rounded-full border',
              drawing.style.color === color ? 'border-silver-100' : 'border-carbon-700',
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <div className="flex items-center gap-0.5" role="group" aria-label="Width">
        {DRAWING_WIDTHS.map((width) => (
          <ToolbarButton
            key={width}
            label={`Width ${width}`}
            pressed={drawing.style.width === width}
            onClick={() => setStyle({ width })}
          >
            {width}
          </ToolbarButton>
        ))}
      </div>

      <div className="flex items-center gap-0.5" role="group" aria-label="Line style">
        {DRAWING_LINE_STYLES.map((lineStyle: DrawingLineStyle) => (
          <ToolbarButton
            key={lineStyle}
            label={`${lineStyle} line`}
            pressed={drawing.style.lineStyle === lineStyle}
            onClick={() => setStyle({ lineStyle })}
          >
            {lineStyle === 'solid' ? '—' : lineStyle === 'dashed' ? '- -' : '···'}
          </ToolbarButton>
        ))}
      </div>

      <DrawingOptionControls drawing={drawing} setOptions={setOptions} />

      <div className="ml-auto flex items-center gap-0.5">
        <ToolbarButton
          label={drawing.locked ? 'Unlock drawing' : 'Lock drawing'}
          pressed={drawing.locked}
          onClick={() =>
            onUpdate((current) => ({ ...current, locked: !current.locked }) as DrawingObject)
          }
        >
          {drawing.locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
        </ToolbarButton>
        <ToolbarButton label="Hide drawing" onClick={onToggleHidden}>
          <EyeOff className="h-3 w-3" />
        </ToolbarButton>
        <ToolbarButton label="Delete drawing" danger onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </ToolbarButton>
      </div>
    </div>
  )
}

function DrawingOptionControls({
  drawing,
  setOptions,
}: {
  drawing: DrawingObject
  setOptions: (patch: Record<string, unknown>) => void
}) {
  switch (drawing.type) {
    case 'trendline':
      return (
        <div className="flex items-center gap-0.5" role="group" aria-label="Trend line options">
          <Toggle
            label="Extend left"
            value={drawing.options.extendLeft}
            onChange={(value) => setOptions({ extendLeft: value })}
          />
          <Toggle
            label="Extend right"
            value={drawing.options.extendRight}
            onChange={(value) => setOptions({ extendRight: value })}
          />
          <Toggle
            label="Angle"
            value={drawing.options.showAngle}
            onChange={(value) => setOptions({ showAngle: value })}
          />
          <Toggle
            label="Price change"
            value={drawing.options.showPriceChange}
            onChange={(value) => setOptions({ showPriceChange: value })}
          />
        </div>
      )
    case 'channel':
      return (
        <div className="flex items-center gap-0.5" role="group" aria-label="Channel options">
          <Toggle
            label="Middle line"
            value={drawing.options.showMiddle}
            onChange={(value) => setOptions({ showMiddle: value })}
          />
          <Toggle
            label="Fill"
            value={drawing.options.fill}
            onChange={(value) => setOptions({ fill: value })}
          />
        </div>
      )
    case 'rect':
      return (
        <div className="flex items-center gap-0.5" role="group" aria-label="Rectangle options">
          <Toggle
            label="Fill"
            value={drawing.options.fill}
            onChange={(value) => setOptions({ fill: value })}
          />
        </div>
      )
    case 'fib':
    case 'fibext': {
      const levels = drawing.type === 'fib' ? FIB_RETRACEMENT_LEVELS : FIB_EXTENSION_LEVELS
      const enabled = drawing.options.levels
      return (
        <div
          className="flex flex-wrap items-center gap-0.5"
          role="group"
          aria-label="Fibonacci levels"
        >
          {levels.map((level) => (
            <ToolbarButton
              key={level}
              label={`Level ${LEVEL_NAMES[level]} percent`}
              pressed={enabled.includes(level)}
              onClick={() =>
                setOptions({
                  levels: enabled.includes(level)
                    ? enabled.filter((value) => value !== level)
                    : [...enabled, level].sort((a, b) => a - b),
                })
              }
            >
              {LEVEL_NAMES[level]}
            </ToolbarButton>
          ))}
          <Toggle
            label="Extend right"
            value={drawing.options.extendRight}
            onChange={(value) => setOptions({ extendRight: value })}
          />
        </div>
      )
    }
    default:
      return null
  }
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <ToolbarButton label={label} pressed={value} onClick={() => onChange(!value)}>
      {label}
    </ToolbarButton>
  )
}

function ToolbarButton({
  label,
  pressed,
  danger = false,
  onClick,
  children,
}: {
  label: string
  pressed?: boolean
  danger?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'flex h-5 min-w-5 items-center justify-center rounded px-1 font-mono text-[10px]',
        pressed ? 'bg-brass-500/20 text-gold-400' : 'text-silver-400 hover:text-silver-100',
        danger && 'hover:text-rose-400',
      )}
    >
      {children}
    </button>
  )
}

/** Places the toolbar above the anchors when there is room, otherwise below, clamped in the chart. */
export function toolbarPosition(
  handles: Point[],
  containerWidth: number,
  containerHeight: number,
): { left: number; top: number } {
  const xs = handles.map((point) => point.x)
  const ys = handles.map((point) => point.y)
  const left = handles.length ? Math.min(...xs) : EDGE_GAP
  const top = handles.length ? Math.min(...ys) : EDGE_GAP
  const bottom = handles.length ? Math.max(...ys) : EDGE_GAP
  const maxLeft = Math.max(EDGE_GAP, containerWidth - TOOLBAR_WIDTH - EDGE_GAP)
  const maxTop = Math.max(EDGE_GAP, containerHeight - TOOLBAR_HEIGHT - EDGE_GAP)
  const above = top - TOOLBAR_HEIGHT - EDGE_GAP
  const preferred = above >= EDGE_GAP ? above : bottom + EDGE_GAP
  return {
    left: Math.min(Math.max(left, EDGE_GAP), maxLeft),
    top: Math.min(Math.max(preferred, EDGE_GAP), maxTop),
  }
}
