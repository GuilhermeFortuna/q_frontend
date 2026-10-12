import type { ResearchFigure } from '@/types/researchFigures'

import { FigureImage } from './FigureImage'
import { PlotlyCardPreview } from './PlotlyFigure'
import type { FigureMark } from './figureFreshness'
import { figureAspectRatio, formatFigureUpdated } from './figureUtils'

const MARK_LABEL: Record<FigureMark, string> = { new: 'New', updated: 'Updated' }
const TAG_CLASS = 'rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] font-medium'

type FigureCardProps = {
  figure: ResearchFigure
  mark?: FigureMark
  showCollection: boolean
  onOpen: (figureId: string) => void
}

export function FigureCard({ figure, mark, showCollection, onOpen }: FigureCardProps) {
  const isInteractive = figure.kind === 'plotly'

  return (
    <button
      type="button"
      onClick={() => onOpen(figure.figure_id)}
      aria-label={figure.title}
      data-testid={`figure-card-${figure.figure_id}`}
      className="quant-panel flex min-w-0 flex-col gap-2 rounded-lg p-3 text-left transition-colors hover:border-white/20 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span
        className="relative block w-full overflow-hidden rounded-md bg-[#ebe9e4]"
        style={{ aspectRatio: figureAspectRatio(figure) }}
      >
        {isInteractive ? (
          <PlotlyCardPreview figure={figure} />
        ) : (
          <FigureImage
            key={`${figure.figure_id}:${figure.revision}`}
            figure={figure}
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-cream-200 truncate text-sm font-medium">{figure.title}</span>
        <span className="text-silver-400 flex flex-wrap items-center gap-x-2 text-xs">
          {showCollection ? <span className="truncate">{figure.collection}</span> : null}
          <span>{formatFigureUpdated(figure.updated_at)}</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={`text-silver-300 ${TAG_CLASS}`}>
            {isInteractive ? 'Interactive' : 'Image'}
          </span>
          {mark ? (
            <span
              className={`text-gold-400 border-brass-500/40 ${TAG_CLASS}`}
              data-testid={`figure-mark-${figure.figure_id}`}
            >
              {MARK_LABEL[mark]}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  )
}
