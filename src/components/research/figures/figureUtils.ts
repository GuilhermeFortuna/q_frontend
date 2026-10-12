import { formatDistanceToNow, parseISO } from 'date-fns'

import type {
  ResearchFigure,
  ResearchFigureCollection,
  ResearchFigureProvenanceInfo,
} from '@/types/researchFigures'

/** Used for Plotly figures and images without stored dimensions. */
export const FIGURE_FALLBACK_ASPECT_RATIO = '4 / 3'

export const RESEARCH_FIGURE_SNIPPET = [
  'from q_backend import research',
  '# build a Matplotlib or Plotly figure, then publish it:',
  'research.publish_figure(fig, title="Walk-forward equity")',
].join('\n')

export function figureAspectRatio(figure: Pick<ResearchFigure, 'width' | 'height'>): string {
  if (figure.width && figure.height) return `${figure.width} / ${figure.height}`
  return FIGURE_FALLBACK_ASPECT_RATIO
}

export function sortFiguresNewestFirst(figures: readonly ResearchFigure[]): ResearchFigure[] {
  return [...figures].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export function sortCollectionsNewestFirst(
  collections: readonly ResearchFigureCollection[],
): ResearchFigureCollection[] {
  return [...collections].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

/** Count across every collection, so the **All figures** entry does not depend on the filter. */
export function totalFigureCount(collections: readonly ResearchFigureCollection[]): number {
  return collections.reduce((sum, collection) => sum + collection.count, 0)
}

export function formatFigureUpdated(updatedAt: string): string {
  return formatDistanceToNow(parseISO(updatedAt), { addSuffix: true })
}

/** Short git revision for display. Missing or empty values render as an em dash. */
export function shortGitRevision(provenance: ResearchFigureProvenanceInfo | null | undefined) {
  const revision = provenance?.git_revision
  return revision ? revision.slice(0, 8) : '—'
}

export function figureBaseName(figure: Pick<ResearchFigure, 'title'>): string {
  const slug = figure.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'figure'
}

export function figureExtension(figure: Pick<ResearchFigure, 'kind' | 'media_type'>): string {
  if (figure.kind === 'image' && figure.media_type === 'image/svg+xml') return 'svg'
  return 'png'
}
