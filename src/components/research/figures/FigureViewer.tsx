import { useEffect, useRef, useState, type ReactNode } from 'react'

import {
  fetchResearchFigureBlob,
  useDeleteResearchFigure,
  useResearchFigureMetadata,
  useResearchFigurePlotly,
} from '@/api/queries/researchFigures'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader } from '@/components/ui/Dialog'
import { toast } from '@/components/ui/toast'
import { useFullscreen } from '@/hooks/useFullscreen'
import { formatDisplayDateTime } from '@/lib/formatDate'
import type { ResearchFigure } from '@/types/researchFigures'

import { FigureImage } from './FigureImage'
import { PlotlyChart } from './PlotlyFigure'
import { downloadPlotlyPng } from './plotlyLoader'
import { figureBaseName, figureExtension, shortGitRevision } from './figureUtils'

const MISSING_CLASS =
  'text-silver-400 flex h-full w-full items-center justify-center p-4 text-center text-sm'

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

type FigureViewerProps = {
  figureId: string | null
  /** The list the viewer steps through, in the order the grid shows it. */
  figures: readonly ResearchFigure[]
  onOpen: (figureId: string) => void
  onClose: () => void
}

export function FigureViewer({ figureId, figures, onOpen, onClose }: FigureViewerProps) {
  const metadata = useResearchFigureMetadata(figureId)
  const listed = figureId ? figures.find((item) => item.figure_id === figureId) : undefined
  // The polled list keeps a figure current; metadata covers a deep link outside the list.
  const figure = listed ?? metadata.data
  const index = figure ? figures.findIndex((item) => item.figure_id === figure.figure_id) : -1
  const previous = index > 0 ? figures[index - 1] : undefined
  const next = index >= 0 && index < figures.length - 1 ? figures[index + 1] : undefined

  const unknown = figureId !== null && !listed && metadata.isError
  const noticeFor = useRef<string | null>(null)

  useEffect(() => {
    if (!figureId) {
      noticeFor.current = null
      return
    }
    if (!unknown || noticeFor.current === figureId) return
    noticeFor.current = figureId
    toast.info('That figure is no longer available.')
    onClose()
  }, [figureId, unknown, onClose])

  const open = figureId !== null && !unknown

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
    >
      <DialogContent
        size="lg"
        className="max-h-[92dvh] max-w-[min(96vw,1280px)] overflow-hidden"
        data-testid="figure-viewer"
      >
        <DialogDescription className="sr-only">Research figure</DialogDescription>
        <FigureViewerBody
          figure={figure}
          position={index >= 0 ? { index, total: figures.length } : null}
          previous={previous}
          next={next}
          onOpen={onOpen}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}

type FigureViewerBodyProps = {
  figure: ResearchFigure | undefined
  position: { index: number; total: number } | null
  previous: ResearchFigure | undefined
  next: ResearchFigure | undefined
  onOpen: (figureId: string) => void
  onClose: () => void
}

function FigureViewerBody({
  figure,
  position,
  previous,
  next,
  onOpen,
  onClose,
}: FigureViewerBodyProps) {
  const fullscreen = useFullscreen<HTMLDivElement>()
  const plotRef = useRef<HTMLDivElement>(null)
  const deleteFigure = useDeleteResearchFigure()
  const [actualSize, setActualSize] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const isPlotly = figure?.kind === 'plotly'
  const plotly = useResearchFigurePlotly(
    figure ? { figureId: figure.figure_id, revision: figure.revision } : null,
    isPlotly === true,
  )

  const previousId = previous?.figure_id
  const nextId = next?.figure_id
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName))) {
        return
      }
      if (event.key === 'ArrowLeft' && previousId) {
        event.preventDefault()
        onOpen(previousId)
      } else if (event.key === 'ArrowRight' && nextId) {
        event.preventDefault()
        onOpen(nextId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previousId, nextId, onOpen])

  const download = async () => {
    if (!figure) return
    try {
      if (figure.kind === 'plotly') {
        if (!plotRef.current) return
        await downloadPlotlyPng(plotRef.current, figureBaseName(figure))
      } else {
        const blob = await fetchResearchFigureBlob(figure.figure_id, figure.revision)
        saveBlob(blob, `${figureBaseName(figure)}.${figureExtension(figure)}`)
      }
    } catch {
      toast.error('Could not download the figure.')
    }
  }

  const confirmDelete = () => {
    if (!figure) return
    const target = next ?? previous
    deleteFigure.mutate(figure.figure_id, {
      onSuccess: () => {
        toast.success(`Deleted “${figure.title}”`)
        setConfirmingDelete(false)
        if (target) onOpen(target.figure_id)
        else onClose()
      },
      onError: () => {
        toast.error('Could not delete the figure.')
        setConfirmingDelete(false)
      },
    })
  }

  const provenance = figure?.provenance

  let stage: ReactNode
  if (!figure) {
    stage = <span className={MISSING_CLASS}>Loading figure…</span>
  } else if (isPlotly) {
    stage = plotly.data ? (
      <PlotlyChart
        figure={plotly.data.figure}
        interactive
        className="h-full min-h-[50dvh] w-full"
        containerRef={plotRef}
      />
    ) : plotly.isError ? (
      <span role="status" className={MISSING_CLASS}>
        Figure content is missing
      </span>
    ) : (
      <span className={MISSING_CLASS}>Loading chart…</span>
    )
  } else {
    stage = (
      <FigureImage
        key={`${figure.figure_id}:${figure.revision}`}
        figure={figure}
        className={actualSize ? 'block max-w-none' : 'h-full w-full object-contain'}
        missingLabel="Figure content is missing"
      />
    )
  }

  return (
    <>
      <DialogHeader
        title={figure?.title ?? 'Figure'}
        right={position ? `${position.index + 1} / ${position.total}` : undefined}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div
          ref={fullscreen.elementRef}
          className="flex min-h-[50dvh] min-w-0 flex-1 items-center justify-center overflow-auto rounded-md bg-[#ebe9e4] p-2"
        >
          {stage}
        </div>
        {figure ? (
          <aside className="text-silver-300 flex shrink-0 flex-col gap-3 text-sm lg:w-72">
            <div>
              <h3 className="text-silver-400 text-xs tracking-wide uppercase">Notes</h3>
              <p className="whitespace-pre-wrap">{figure.notes || 'No notes'}</p>
            </div>
            <dl className="grid gap-2">
              <div>
                <dt className="text-silver-400 text-xs">Created</dt>
                <dd>{formatDisplayDateTime(figure.created_at)}</dd>
              </div>
              <div>
                <dt className="text-silver-400 text-xs">Updated</dt>
                <dd>{formatDisplayDateTime(figure.updated_at)}</dd>
              </div>
              <div>
                <dt className="text-silver-400 text-xs">Script</dt>
                <dd className="font-mono text-xs break-all">{provenance?.script ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-silver-400 text-xs">Git revision</dt>
                <dd className="font-mono text-xs">
                  {shortGitRevision(provenance)}
                  {provenance?.git_dirty ? ' · uncommitted changes' : ''}
                </dd>
              </div>
            </dl>
          </aside>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={!previous}
            onClick={() => previous && onOpen(previous.figure_id)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!next}
            onClick={() => next && onOpen(next.figure_id)}
          >
            Next
          </Button>
        </div>
        {figure ? (
          <div className="flex flex-wrap gap-2">
            {isPlotly ? null : (
              <Button
                type="button"
                variant="outline"
                aria-pressed={actualSize}
                onClick={() => setActualSize((value) => !value)}
              >
                {actualSize ? 'Fit to area' : 'Actual size'}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                fullscreen.isFullscreen ? void fullscreen.exit() : void fullscreen.enter()
              }
            >
              {fullscreen.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </Button>
            <Button type="button" variant="outline" onClick={() => void download()}>
              Download
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-rose-400 hover:text-rose-300"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmingDelete}
        title="Delete figure?"
        description={`Delete “${figure?.title ?? ''}” and its stored content? This cannot be undone.`}
        loading={deleteFigure.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  )
}
