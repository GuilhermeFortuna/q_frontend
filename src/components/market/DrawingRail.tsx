import type { LucideIcon } from 'lucide-react'
import { Eraser, Layers, Minus, MousePointer, TrendingUp, Type } from 'lucide-react'

import type { DrawingTool } from '@/components/charts/types/chart'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { cn } from '@/lib/utils'

const DRAWING_TOOLS: Array<{ tool: DrawingTool; icon: LucideIcon; title: string }> = [
  { tool: 'cursor', icon: MousePointer, title: 'Crosshair Cursor Pointer' },
  { tool: 'trendline', icon: TrendingUp, title: 'Draw Trendline' },
  { tool: 'horizontal', icon: Minus, title: 'Draw Support/Resistance Line' },
  { tool: 'fibo', icon: Layers, title: 'Draw Fibonacci Retracements' },
  { tool: 'text', icon: Type, title: 'Insert Text Annotation' },
]

export type DrawingRailProps = {
  activeDrawingTool: DrawingTool
  onActiveDrawingToolChange: (tool: DrawingTool) => void
  onClearDrawings: () => void
}

export function DrawingRail({
  activeDrawingTool,
  onActiveDrawingToolChange,
  onClearDrawings,
}: DrawingRailProps) {
  return (
    <div className="surface-well flex w-[44px] shrink-0 flex-col items-center gap-3.5 rounded-lg py-4">
      <SectionHeader title="Draw" className="mb-1 select-none" />

      {DRAWING_TOOLS.map(({ tool, icon: Icon, title }) => {
        const selected = activeDrawingTool === tool
        return (
          <button
            key={tool}
            type="button"
            onClick={() => onActiveDrawingToolChange(tool)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md transition-all duration-150',
              'focus-visible:outline-brass-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              selected
                ? 'accent-state text-gold-400'
                : 'surface-control text-silver-400 hover:border-brass-500/40 hover:text-silver-100 active:scale-95',
            )}
            title={title}
          >
            <Icon className="h-4 w-4" />
          </button>
        )
      })}

      <div className="border-carbon-700 my-2 w-8 border-t" />

      <button
        type="button"
        onClick={() => {
          onClearDrawings()
          onActiveDrawingToolChange('cursor')
        }}
        className="surface-control text-silver-400 flex h-8 w-8 items-center justify-center rounded-md transition-all hover:text-rose-400 active:scale-90"
        title="Clear all drawings"
        aria-label="Clear all drawings"
      >
        <Eraser className="h-4 w-4" />
      </button>
    </div>
  )
}
