import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { Config, Data, Layout } from 'plotly.js-dist-min'

import { useResearchFigurePlotly } from '@/api/queries/researchFigures'
import type { ResearchFigure, ResearchFigurePlotly } from '@/types/researchFigures'

import { loadPlotly, type PlotlyApi } from './plotlyLoader'

const CARD_CONFIG: Partial<Config> = { staticPlot: true, responsive: true, displaylogo: false }
const VIEWER_CONFIG: Partial<Config> = { responsive: true, displaylogo: false }

type PlotlyChartProps = {
  figure: ResearchFigurePlotly['figure']
  interactive: boolean
  className?: string
  containerRef?: RefObject<HTMLDivElement | null>
}

/**
 * Draws a Plotly figure as authored. The plot is purged on unmount, so a grid of
 * cards never keeps more plots alive than are on screen.
 */
export function PlotlyChart({ figure, interactive, className, containerRef }: PlotlyChartProps) {
  const localRef = useRef<HTMLDivElement>(null)
  const elementRef = containerRef ?? localRef
  const [error, setError] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    let disposed = false
    let api: PlotlyApi | null = null

    loadPlotly()
      .then((plotly) => {
        api = plotly
        if (disposed) return undefined
        return plotly.react(
          element,
          figure.data as Data[],
          (figure.layout ?? {}) as Partial<Layout>,
          interactive ? VIEWER_CONFIG : CARD_CONFIG,
        )
      })
      .catch(() => {
        if (!disposed) setError(true)
      })

    return () => {
      disposed = true
      if (api) api.purge(element)
    }
  }, [elementRef, figure, interactive])

  if (error) {
    return (
      <span
        role="status"
        className="text-silver-400 flex h-full w-full items-center justify-center text-xs"
      >
        The chart could not be drawn.
      </span>
    )
  }

  return <div ref={elementRef} className={className ?? 'h-full w-full'} />
}

type PlotlyCardPreviewProps = {
  figure: ResearchFigure
}

/**
 * Card preview for a Plotly figure. The content loads and the static plot mounts only
 * while the card is near the viewport; scrolling away purges the plot.
 */
export function PlotlyCardPreview({ figure }: PlotlyCardPreviewProps) {
  const hostRef = useRef<HTMLSpanElement>(null)
  const [inView, setInView] = useState(false)
  const content = useResearchFigurePlotly(
    { figureId: figure.figure_id, revision: figure.revision },
    inView,
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => setInView(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: '160px' },
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  let body: ReactNode
  if (!inView) {
    body = (
      <span className="text-silver-400 flex h-full w-full items-center justify-center text-xs">
        Interactive figure
      </span>
    )
  } else if (content.isError) {
    body = (
      <span
        role="status"
        className="text-silver-400 flex h-full w-full items-center justify-center text-xs"
      >
        Figure content is missing
      </span>
    )
  } else if (content.data) {
    body = <PlotlyChart figure={content.data.figure} interactive={false} />
  } else {
    body = (
      <span className="text-silver-400 flex h-full w-full items-center justify-center text-xs">
        Loading chart…
      </span>
    )
  }

  return (
    <span
      ref={hostRef}
      className="block h-full w-full"
      data-testid={`figure-plotly-${figure.figure_id}`}
    >
      {body}
    </span>
  )
}
