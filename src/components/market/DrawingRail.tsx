import { useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChartNoAxesGantt,
  ChevronRight,
  Eraser,
  Eye,
  EyeOff,
  Layers,
  Magnet,
  Minus,
  MousePointer,
  MoveRight,
  Pin,
  Rows3,
  SeparatorVertical,
  Square,
  TrendingUp,
  Type,
  type LucideIcon,
} from 'lucide-react'

import type { DrawingTool, PlacementTool } from '@/components/charts/drawings/model'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { cn } from '@/lib/utils'

type ToolEntry = { tool: PlacementTool; label: string; icon: LucideIcon }
type ToolGroup = { id: string; label: string; tools: ToolEntry[] }

/** Placement tools grouped into rail flyouts. Each group button arms the group's last-used tool. */
export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'lines',
    label: 'Lines',
    tools: [
      { tool: 'trendline', label: 'Trend line', icon: TrendingUp },
      { tool: 'hline', label: 'Horizontal line', icon: Minus },
      { tool: 'hray', label: 'Horizontal ray', icon: MoveRight },
      { tool: 'vline', label: 'Vertical line', icon: SeparatorVertical },
    ],
  },
  {
    id: 'shapes',
    label: 'Shapes',
    tools: [
      { tool: 'channel', label: 'Parallel channel', icon: Rows3 },
      { tool: 'rect', label: 'Rectangle', icon: Square },
    ],
  },
  {
    id: 'fibonacci',
    label: 'Fibonacci',
    tools: [
      { tool: 'fib', label: 'Fibonacci retracement', icon: Layers },
      { tool: 'fibext', label: 'Trend-based extension', icon: ChartNoAxesGantt },
    ],
  },
  {
    id: 'positions',
    label: 'Positions',
    tools: [
      { tool: 'long', label: 'Long position', icon: ArrowUpFromLine },
      { tool: 'short', label: 'Short position', icon: ArrowDownToLine },
    ],
  },
  {
    id: 'text',
    label: 'Text',
    tools: [{ tool: 'text', label: 'Text note', icon: Type }],
  },
]

const buttonBase =
  'flex h-8 w-8 items-center justify-center rounded-md transition-all duration-150 focus-visible:outline-brass-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
const idleButton =
  'surface-control text-silver-400 hover:border-brass-500/40 hover:text-silver-100 active:scale-95'
const activeButton = 'accent-state text-gold-400'

export type DrawingRailProps = {
  activeDrawingTool: DrawingTool
  onActiveDrawingToolChange: (tool: DrawingTool) => void
  onClearDrawings: () => void
  hasDrawings?: boolean
  magnet: boolean
  onMagnetChange: (value: boolean) => void
  keepDrawing: boolean
  onKeepDrawingChange: (value: boolean) => void
  hideAll: boolean
  onHideAllChange: (value: boolean) => void
}

export function DrawingRail({
  activeDrawingTool,
  onActiveDrawingToolChange,
  onClearDrawings,
  hasDrawings = true,
  magnet,
  onMagnetChange,
  keepDrawing,
  onKeepDrawingChange,
  hideAll,
  onHideAllChange,
}: DrawingRailProps) {
  const [lastTool, setLastTool] = useState<Record<string, PlacementTool>>(() =>
    Object.fromEntries(TOOL_GROUPS.map((group) => [group.id, group.tools[0].tool])),
  )
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const armTool = (tool: DrawingTool) => {
    onActiveDrawingToolChange(tool)
    setOpenGroup(null)
  }

  return (
    <div className="surface-well relative flex w-[44px] shrink-0 flex-col items-center gap-2.5 rounded-lg py-4">
      <SectionHeader title="Draw" className="mb-1 select-none" />

      <button
        type="button"
        onClick={() => armTool('cursor')}
        className={cn(buttonBase, activeDrawingTool === 'cursor' ? activeButton : idleButton)}
        title="Crosshair Cursor Pointer"
        aria-label="Crosshair cursor"
        aria-pressed={activeDrawingTool === 'cursor'}
      >
        <MousePointer className="h-4 w-4" />
      </button>

      {TOOL_GROUPS.map((group) => {
        const current =
          group.tools.find((entry) => entry.tool === lastTool[group.id]) ?? group.tools[0]
        const Icon = current.icon
        const armed = group.tools.some((entry) => entry.tool === activeDrawingTool)
        return (
          <div key={group.id} className="relative flex items-center">
            <button
              type="button"
              onClick={() => armTool(current.tool)}
              className={cn(buttonBase, armed ? activeButton : idleButton)}
              title={`${group.label}: ${current.label}`}
              aria-label={`${group.label}: ${current.label}`}
              aria-pressed={armed}
            >
              <Icon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setOpenGroup((prev) => (prev === group.id ? null : group.id))}
              className="text-silver-500 hover:text-silver-200 -ml-0.5 flex h-8 w-3 items-center justify-center"
              aria-label={`More ${group.label.toLowerCase()} tools`}
              aria-expanded={openGroup === group.id}
              title={`More ${group.label.toLowerCase()} tools`}
            >
              <ChevronRight className="h-2.5 w-2.5" />
            </button>
            {openGroup === group.id && (
              <div
                role="menu"
                aria-label={`${group.label} tools`}
                className="surface-float absolute top-0 left-full z-20 ml-2 flex flex-col gap-1 rounded-lg p-1.5"
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setOpenGroup(null)
                }}
              >
                {group.tools.map((entry) => {
                  const EntryIcon = entry.icon
                  return (
                    <button
                      key={entry.tool}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setLastTool((prev) => ({ ...prev, [group.id]: entry.tool }))
                        armTool(entry.tool)
                      }}
                      className={cn(
                        'text-silver-300 hover:bg-carbon-800/60 flex items-center gap-2 rounded px-2 py-1 font-mono text-[11px] whitespace-nowrap',
                        activeDrawingTool === entry.tool && 'text-gold-400',
                      )}
                    >
                      <EntryIcon className="h-3.5 w-3.5" />
                      {entry.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <div className="border-carbon-700 my-1 w-8 border-t" />

      <button
        type="button"
        onClick={() => onMagnetChange(!magnet)}
        className={cn(buttonBase, magnet ? activeButton : idleButton)}
        title="Magnet: snap anchors to OHLC or the tick size"
        aria-label="Magnet"
        aria-pressed={magnet}
      >
        <Magnet className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onKeepDrawingChange(!keepDrawing)}
        className={cn(buttonBase, keepDrawing ? activeButton : idleButton)}
        title="Keep drawing: stay on the tool after each drawing"
        aria-label="Keep drawing"
        aria-pressed={keepDrawing}
      >
        <Pin className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onHideAllChange(!hideAll)}
        className={cn(buttonBase, hideAll ? activeButton : idleButton)}
        title={hideAll ? 'Show all drawings' : 'Hide all drawings'}
        aria-label={hideAll ? 'Show all drawings' : 'Hide all drawings'}
        aria-pressed={hideAll}
      >
        {hideAll ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>

      <div className="border-carbon-700 my-1 w-8 border-t" />

      <button
        type="button"
        onClick={() => setConfirmClear(true)}
        disabled={!hasDrawings}
        className="surface-control text-silver-400 flex h-8 w-8 items-center justify-center rounded-md transition-all hover:text-rose-400 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
        title="Clear all drawings"
        aria-label="Clear all drawings"
      >
        <Eraser className="h-4 w-4" />
      </button>

      <ConfirmDialog
        open={confirmClear}
        title="Clear all drawings?"
        description="Every drawing on this symbol is removed. You can undo this with Ctrl+Z."
        confirmLabel="Clear all"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false)
          onClearDrawings()
          onActiveDrawingToolChange('cursor')
        }}
      />
    </div>
  )
}
