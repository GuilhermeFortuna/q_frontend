import type { LucideIcon } from 'lucide-react'
import { Eraser, Layers, Minus, MousePointer, TrendingUp, Type } from 'lucide-react'

import type { DrawingTool } from '@/components/charts/types/chart'

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
    <div className="quant-panel flex w-[44px] shrink-0 flex-col items-center gap-3.5 rounded-lg py-4">
      <div className="text-silver-400 mb-1 text-[9px] font-semibold tracking-wider uppercase select-none">
        Draw
      </div>

      {DRAWING_TOOLS.map(({ tool, icon: Icon, title }) => (
        <button
          key={tool}
          onClick={() => onActiveDrawingToolChange(tool)}
          className={`flex h-8 w-8 items-center justify-center rounded transition-all duration-200 ${
            activeDrawingTool === tool
              ? 'from-brass-400 to-brass-500 text-carbon-950 scale-105 bg-gradient-to-br font-bold shadow-[0_0_12px_rgba(196,165,116,0.4)]'
              : 'text-silver-400 hover:text-silver-100 hover:bg-carbon-800/50 hover:scale-105'
          }`}
          title={title}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}

      <div className="border-carbon-700 my-2 w-8 border-t" />

      <button
        onClick={() => {
          onClearDrawings()
          onActiveDrawingToolChange('cursor')
        }}
        className="text-silver-400 hover:bg-carbon-700/60 flex h-8 w-8 items-center justify-center rounded transition-all hover:text-red-400 active:scale-90"
        title="Clear all drawings"
        aria-label="Clear all drawings"
      >
        <Eraser className="h-4 w-4" />
      </button>
    </div>
  )
}
