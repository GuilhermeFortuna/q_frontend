import type { BulkDeleteResponse } from '../../contracts/api'
import type {
  ResearchFigure,
  ResearchFigureBulkDelete,
  ResearchFigureCollection,
  ResearchFigureListPage,
} from '@/types/researchFigures'

export const MOCK_PNG_FIGURE_ID = 'fig_png_rsi'
export const MOCK_SVG_FIGURE_ID = 'fig_svg_equity'
export const MOCK_PLOTLY_FIGURE_ID = 'fig_plotly_corr'
export const MOCK_MISSING_FIGURE_ID = 'fig_missing_content'

// 1×1 transparent PNG; the card and viewer size the box from metadata, not from the pixels.
const MOCK_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

const MOCK_SVG_MARKUP = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">',
  '<rect width="800" height="400" fill="#f5f5f4"/>',
  '<polyline fill="none" stroke="#8a6d3b" stroke-width="4" points="20,340 160,300 300,320 440,190 580,220 780,60"/>',
  '</svg>',
].join('')

export type MockResearchFigureContent =
  | { kind: 'image'; mediaType: 'image/png'; base64: string }
  | { kind: 'image'; mediaType: 'image/svg+xml'; markup: string }
  | {
      kind: 'plotly'
      figure: { data: Array<Record<string, unknown>>; layout: Record<string, unknown> }
    }

type MockFigureRecord = {
  metadata: ResearchFigure
  /** `null` models a figure whose stored content was removed. */
  content: MockResearchFigureContent | null
}

function mockPlotlyContent(): MockResearchFigureContent {
  return {
    kind: 'plotly',
    figure: {
      data: [
        {
          type: 'heatmap',
          x: ['rsi', 'macd', 'atr', 'adx'],
          y: ['rsi', 'macd', 'atr', 'adx'],
          z: [
            [1, 0.42, -0.18, 0.07],
            [0.42, 1, 0.11, -0.31],
            [-0.18, 0.11, 1, 0.56],
            [0.07, -0.31, 0.56, 1],
          ],
          colorscale: 'RdBu',
          zmid: 0,
        },
      ],
      layout: { title: { text: 'Feature correlation' }, margin: { t: 48, r: 16, b: 40, l: 56 } },
    },
  }
}

function seedFigures(): MockFigureRecord[] {
  return [
    {
      metadata: {
        figure_id: MOCK_PNG_FIGURE_ID,
        title: 'RSI distribution by regime',
        collection: 'momentum-study',
        kind: 'image',
        media_type: 'image/png',
        byte_size: 412,
        revision: 1,
        created_at: '2026-10-12T09:10:00Z',
        updated_at: '2026-10-12T09:10:00Z',
        width: 640,
        height: 400,
        notes: 'Regimes split at ADX 25. Shows the RSI tails used by the entry filter.',
        provenance: {
          script: 'research/rsi_regimes.py',
          git_revision: '9f2c1ab',
          git_dirty: false,
        },
      },
      content: { kind: 'image', mediaType: 'image/png', base64: MOCK_PNG_BASE64 },
    },
    {
      metadata: {
        figure_id: MOCK_SVG_FIGURE_ID,
        title: 'Walk-forward equity (SVG)',
        collection: 'momentum-study',
        kind: 'image',
        media_type: 'image/svg+xml',
        byte_size: MOCK_SVG_MARKUP.length,
        revision: 2,
        created_at: '2026-10-12T08:40:00Z',
        updated_at: '2026-10-12T09:25:00Z',
        width: 800,
        height: 400,
        notes: null,
        provenance: {
          script: 'research/equity_curve.py',
          git_revision: '9f2c1ab',
          git_dirty: true,
        },
      },
      content: { kind: 'image', mediaType: 'image/svg+xml', markup: MOCK_SVG_MARKUP },
    },
    {
      metadata: {
        figure_id: MOCK_PLOTLY_FIGURE_ID,
        title: 'Feature correlation',
        collection: 'feature-correlation',
        kind: 'plotly',
        media_type: 'application/json',
        byte_size: 1184,
        revision: 1,
        created_at: '2026-10-11T18:05:00Z',
        updated_at: '2026-10-11T18:05:00Z',
        width: null,
        height: null,
        notes: 'Pearson correlation on the training window.',
        provenance: null,
      },
      content: mockPlotlyContent(),
    },
    {
      metadata: {
        figure_id: MOCK_MISSING_FIGURE_ID,
        title: 'Stored content removed',
        collection: 'feature-correlation',
        kind: 'image',
        media_type: 'image/png',
        byte_size: 0,
        revision: 1,
        created_at: '2026-10-10T12:00:00Z',
        updated_at: '2026-10-10T12:00:00Z',
        width: 640,
        height: 400,
        notes: null,
        provenance: null,
      },
      content: null,
    },
  ]
}

let figures = seedFigures()

export function resetMockResearchFigures() {
  figures = seedFigures()
}

/** Test helper: add a figure as a later script run would. */
export function addMockResearchFigure(record: MockFigureRecord) {
  figures = [
    record,
    ...figures.filter((item) => item.metadata.figure_id !== record.metadata.figure_id),
  ]
}

/** Test helper: replace a figure's content and bump its revision, as a re-publish does. */
export function replaceMockResearchFigure(figureId: string, content: MockResearchFigureContent) {
  figures = figures.map((item) =>
    item.metadata.figure_id === figureId
      ? {
          metadata: {
            ...item.metadata,
            revision: item.metadata.revision + 1,
            updated_at: new Date().toISOString(),
          },
          content,
        }
      : item,
  )
}

function byUpdatedDesc(a: ResearchFigure, b: ResearchFigure) {
  return b.updated_at.localeCompare(a.updated_at)
}

export function getMockResearchFigureRecord(figureId: string): MockFigureRecord | undefined {
  return figures.find((item) => item.metadata.figure_id === figureId)
}

export function mockResearchFigureCollections(): ResearchFigureCollection[] {
  const byName = new Map<string, ResearchFigureCollection>()
  for (const { metadata } of figures) {
    const current = byName.get(metadata.collection)
    if (!current) {
      byName.set(metadata.collection, {
        name: metadata.collection,
        count: 1,
        updated_at: metadata.updated_at,
      })
    } else {
      current.count += 1
      if (metadata.updated_at > current.updated_at) current.updated_at = metadata.updated_at
    }
  }
  return [...byName.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export function listMockResearchFigures({
  collection,
  offset,
  limit,
}: {
  collection: string | null
  offset: number
  limit: number
}): ResearchFigureListPage {
  const matching = figures
    .map((item) => item.metadata)
    .filter((metadata) => !collection || metadata.collection === collection)
    .sort(byUpdatedDesc)
  return {
    collections: mockResearchFigureCollections(),
    items: matching.slice(offset, offset + limit),
    total: matching.length,
    limit,
    offset,
  }
}

export function deleteMockResearchFigure(figureId: string): boolean {
  const before = figures.length
  figures = figures.filter((item) => item.metadata.figure_id !== figureId)
  return figures.length < before
}

export function bulkDeleteMockResearchFigures(
  request: ResearchFigureBulkDelete,
): BulkDeleteResponse {
  if ('collection' in request) {
    const before = figures.length
    figures = figures.filter((item) => item.metadata.collection !== request.collection)
    return { deleted: before - figures.length, not_found: [] }
  }

  const notFound: string[] = []
  let deleted = 0
  for (const figureId of request.figure_ids) {
    if (deleteMockResearchFigure(figureId)) deleted += 1
    else notFound.push(figureId)
  }
  return { deleted, not_found: notFound }
}
