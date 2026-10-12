import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { createElement, type ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  bulkDeleteResearchFigures,
  deleteResearchFigure,
  fetchResearchFigure,
  fetchResearchFigurePlotly,
  fetchResearchFigures,
  nextResearchFigurePageOffset,
  RESEARCH_FIGURE_POLL_INTERVAL_MS,
  researchFigureContentUrl,
  researchFigurePollInterval,
  useResearchFigureList,
} from '@/api/queries/researchFigures'
import { handlers } from '@/mocks/handlers'
import {
  MOCK_MISSING_FIGURE_ID,
  MOCK_PLOTLY_FIGURE_ID,
  MOCK_PNG_FIGURE_ID,
  resetMockResearchFigures,
} from '@/mocks/researchFigures'
import type { ResearchFigureListPage } from '@/types/researchFigures'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetMockResearchFigures())
afterEach(() => {
  server.resetHandlers()
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})
afterAll(() => server.close())

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('research figures API', () => {
  it('fetchResearchFigures returns items and collection counts for the whole store', async () => {
    const page = await fetchResearchFigures({})

    expect(page.total).toBe(4)
    expect(page.items.map((item) => item.figure_id)).toContain(MOCK_PNG_FIGURE_ID)
    expect(page.collections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'momentum-study', count: 2 }),
        expect.objectContaining({ name: 'feature-correlation', count: 2 }),
      ]),
    )
  })

  it('sends the collection filter but keeps counts for every collection', async () => {
    const page = await fetchResearchFigures({ collection: 'feature-correlation' })

    expect(page.items).toHaveLength(2)
    expect(page.items.every((item) => item.collection === 'feature-correlation')).toBe(true)
    expect(page.collections.map((collection) => collection.name)).toEqual(
      expect.arrayContaining(['momentum-study', 'feature-correlation']),
    )
  })

  it('fetchResearchFigure returns metadata for one figure', async () => {
    const figure = await fetchResearchFigure(MOCK_PNG_FIGURE_ID)

    expect(figure).toMatchObject({
      figure_id: MOCK_PNG_FIGURE_ID,
      media_type: 'image/png',
      revision: 1,
      width: 640,
      height: 400,
    })
  })

  it('content URLs carry the revision so a replaced figure gets a new address', () => {
    expect(researchFigureContentUrl(MOCK_PNG_FIGURE_ID, 1)).not.toBe(
      researchFigureContentUrl(MOCK_PNG_FIGURE_ID, 2),
    )
    expect(researchFigureContentUrl(MOCK_PNG_FIGURE_ID, 3)).toMatch(
      /\/api\/v1\/research\/figures\/fig_png_rsi\/content\?rev=3$/,
    )
  })

  it('fetchResearchFigurePlotly returns the authored figure JSON', async () => {
    const content = await fetchResearchFigurePlotly(MOCK_PLOTLY_FIGURE_ID, 1)

    expect(content.kind).toBe('plotly')
    expect(content.figure.data[0]).toMatchObject({ type: 'heatmap' })
  })

  it('deleteResearchFigure removes one figure from the store', async () => {
    await deleteResearchFigure(MOCK_PNG_FIGURE_ID)

    const page = await fetchResearchFigures({})
    expect(page.items.map((item) => item.figure_id)).not.toContain(MOCK_PNG_FIGURE_ID)
  })

  it('bulkDeleteResearchFigures deletes a whole collection', async () => {
    const result = await bulkDeleteResearchFigures({ collection: 'feature-correlation' })

    expect(result).toEqual({ deleted: 2, not_found: [] })
    const page = await fetchResearchFigures({})
    expect(page.collections.map((collection) => collection.name)).not.toContain(
      'feature-correlation',
    )
  })

  it('bulkDeleteResearchFigures reports ids that do not exist', async () => {
    const result = await bulkDeleteResearchFigures({ figure_ids: [MOCK_PNG_FIGURE_ID, 'nope'] })

    expect(result).toEqual({ deleted: 1, not_found: ['nope'] })
  })

  it('a figure whose content was removed still has metadata but a 404 content route', async () => {
    const figure = await fetchResearchFigure(MOCK_MISSING_FIGURE_ID)
    expect(figure.figure_id).toBe(MOCK_MISSING_FIGURE_ID)

    const response = await fetch(researchFigureContentUrl(MOCK_MISSING_FIGURE_ID, 1))
    expect(response.status).toBe(404)
  })

  it('researchFigurePollInterval polls every 2 seconds only while the document is visible', () => {
    expect(RESEARCH_FIGURE_POLL_INTERVAL_MS).toBe(2_000)

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    expect(researchFigurePollInterval()).toBe(2_000)

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    expect(researchFigurePollInterval()).toBe(false)
  })

  it('useResearchFigureList resolves the first page and reports whether more pages exist', async () => {
    const { result } = renderHook(() => useResearchFigureList({ collection: null }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.pages[0]?.items.length).toBeGreaterThan(0)
    expect(result.current.hasNextPage).toBe(false)
  })

  it('nextResearchFigurePageOffset advances by the loaded count until the total is reached', () => {
    const page = (offset: number, loaded: number, total: number) => ({
      items: Array.from({ length: loaded }, () => ({})),
      offset,
      limit: 100,
      total,
      collections: [],
    })

    expect(
      nextResearchFigurePageOffset(page(0, 100, 250) as unknown as ResearchFigureListPage),
    ).toBe(100)
    expect(
      nextResearchFigurePageOffset(page(200, 50, 250) as unknown as ResearchFigureListPage),
    ).toBeUndefined()
    expect(
      nextResearchFigurePageOffset(page(0, 0, 0) as unknown as ResearchFigureListPage),
    ).toBeUndefined()
  })
})
