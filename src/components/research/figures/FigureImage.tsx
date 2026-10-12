import { useState } from 'react'

import { researchFigureContentUrl } from '@/api/queries/researchFigures'
import type { ResearchFigure } from '@/types/researchFigures'

type FigureImageProps = {
  figure: ResearchFigure
  className?: string
  /** Shown when the content route returns 404; defaults to a short message. */
  missingLabel?: string
}

/**
 * PNG and SVG figures are shown through `<img>` only. SVG markup is never injected,
 * so a script-authored file cannot run in the app's document.
 */
export function FigureImage({
  figure,
  className = 'h-full w-full object-contain',
  missingLabel,
}: FigureImageProps) {
  const [missing, setMissing] = useState(false)

  if (missing) {
    return (
      <span
        role="status"
        className="text-silver-400 flex h-full w-full items-center justify-center p-3 text-center text-xs"
      >
        {missingLabel ?? 'Figure content is missing'}
      </span>
    )
  }

  return (
    <img
      src={researchFigureContentUrl(figure.figure_id, figure.revision)}
      alt={figure.title}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={className}
      onError={() => setMissing(true)}
    />
  )
}
