import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const navigateMock = vi.hoisted(() => vi.fn())

// jsdom has no canvas, and the Plotly card mounts as soon as it is in view. Plotly drawing is covered in PlotlyFigure.test.tsx.
vi.mock('plotly.js-dist-min', () => ({
  default: { react: vi.fn(async (element: HTMLElement) => element), purge: vi.fn() },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

import { handlers } from '@/mocks/handlers'
import {
  addMockResearchFigure,
  bulkDeleteMockResearchFigures,
  MOCK_PLOTLY_FIGURE_ID,
  MOCK_PNG_FIGURE_ID,
  MOCK_SVG_FIGURE_ID,
  replaceMockResearchFigure,
  resetMockResearchFigures,
} from '@/mocks/researchFigures'
import { renderWithQueryClient } from '../../../../../tests/unit/testUtils'
import { FiguresTab } from '../FiguresTab'

const server = setupServer(...handlers)
const requests: Array<{ method: string; url: string }> = []

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
  server.events.on('request:start', ({ request }) => {
    requests.push({ method: request.method, url: request.url })
  })
})
beforeEach(() => {
  resetMockResearchFigures()
  requests.length = 0
  navigateMock.mockClear()
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const cardFor = (title: string) => screen.findByRole('button', { name: title })

describe('FiguresTab', () => {
  it('shows a skeleton while loading, then PNG, SVG and Plotly cards with collection counts', async () => {
    renderWithQueryClient(<FiguresTab />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading figures')

    expect(await cardFor('RSI distribution by regime')).toBeInTheDocument()
    expect(await cardFor('Walk-forward equity (SVG)')).toBeInTheDocument()
    const plotlyCard = await cardFor('Feature correlation')
    expect(within(plotlyCard).getByText('Interactive')).toBeInTheDocument()

    const all = screen.getByTestId('figure-collection-all')
    expect(within(all).getByText('4')).toBeInTheDocument()
    expect(
      within(screen.getByTestId('figure-collection-momentum-study')).getByText('2'),
    ).toBeInTheDocument()
  })

  it('selecting a collection sends it to the list route and narrows the grid', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<FiguresTab />)
    await cardFor('RSI distribution by regime')

    await user.click(screen.getByTestId('figure-collection-feature-correlation'))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'RSI distribution by regime' })).toBeNull()
    })
    expect(screen.getByRole('button', { name: 'Feature correlation' })).toBeInTheDocument()
    expect(
      requests.some(
        (request) =>
          request.method === 'GET' &&
          new URL(request.url).pathname === '/api/v1/research/figures' &&
          new URL(request.url).searchParams.get('collection') === 'feature-correlation',
      ),
    ).toBe(true)
    // Counts still come from every collection, not the selected one.
    expect(within(screen.getByTestId('figure-collection-all')).getByText('4')).toBeInTheDocument()
  })

  it('requests an image card content at its revision, reserves its aspect ratio and never injects SVG', async () => {
    renderWithQueryClient(<FiguresTab />)

    const pngCard = await cardFor('RSI distribution by regime')
    const pngImage = within(pngCard).getByRole('img', { name: 'RSI distribution by regime' })
    expect(pngImage).toHaveAttribute('src', expect.stringMatching(/\/content\?rev=1$/))
    expect(pngCard.querySelector('[style*="aspect-ratio"]')).toHaveAttribute(
      'style',
      expect.stringContaining('640 / 400'),
    )

    const svgCard = await cardFor('Walk-forward equity (SVG)')
    const svgImage = within(svgCard).getByRole('img', { name: 'Walk-forward equity (SVG)' })
    expect(svgImage.tagName).toBe('IMG')
    expect(svgImage).toHaveAttribute(
      'src',
      expect.stringContaining(`${MOCK_SVG_FIGURE_ID}/content?rev=2`),
    )
    expect(svgCard.querySelector('svg')).toBeNull()
  })

  it('shows the card message when the stored content is missing', async () => {
    renderWithQueryClient(<FiguresTab />)

    const card = await cardFor('Stored content removed')
    fireEvent.error(within(card).getByRole('img', { name: 'Stored content removed' }))

    expect(within(card).getByRole('status')).toHaveTextContent('Figure content is missing')
  })

  it('filters loaded cards by title', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<FiguresTab />)
    await cardFor('RSI distribution by regime')

    await user.type(screen.getByRole('searchbox', { name: 'Filter figures by title' }), 'equity')

    expect(screen.getByRole('button', { name: 'Walk-forward equity (SVG)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'RSI distribution by regime' })).toBeNull()
  })

  it('shows the publishing snippet when there are no figures', async () => {
    bulkDeleteMockResearchFigures({ collection: 'momentum-study' })
    bulkDeleteMockResearchFigures({ collection: 'feature-correlation' })
    renderWithQueryClient(<FiguresTab />)

    const empty = await screen.findByTestId('figures-empty')
    expect(empty).toHaveTextContent('research.publish_figure')
    expect(empty).toHaveTextContent('from q_backend import research')
  })

  it('shows an error with Retry and recovers when the list loads again', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('*/api/v1/research/figures', () =>
        HttpResponse.json({ code: 'internal', message: 'boom' }, { status: 500 }),
      ),
    )
    renderWithQueryClient(<FiguresTab />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Figures could not be loaded.')

    server.resetHandlers()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await cardFor('RSI distribution by regime')).toBeInTheDocument()
  })

  it('deletes a collection after confirmation and refreshes the rail', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<FiguresTab />)
    await user.click(await screen.findByTestId('figure-collection-feature-correlation'))

    await user.click(screen.getByTestId('figure-delete-collection'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    await user.click(screen.getByTestId('confirm-dialog-confirm'))

    await waitFor(() => {
      expect(screen.queryByTestId('figure-collection-feature-correlation')).toBeNull()
    })
    expect(requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'POST',
          url: expect.stringMatching(/\/api\/v1\/research\/figures\/bulk-delete$/),
        }),
      ]),
    )
    expect(within(screen.getByTestId('figure-collection-all')).getByText('2')).toBeInTheDocument()
  })

  it('marks a figure that arrives as New and a replaced figure as Updated, and opening it clears the mark', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderWithQueryClient(<FiguresTab />)
    await cardFor('RSI distribution by regime')
    expect(screen.queryByTestId(`figure-mark-${MOCK_PNG_FIGURE_ID}`)).toBeNull()

    addMockResearchFigure({
      metadata: {
        figure_id: 'fig_new_drawdown',
        title: 'Drawdown by month',
        collection: 'momentum-study',
        kind: 'image',
        media_type: 'image/svg+xml',
        byte_size: 10,
        revision: 1,
        created_at: '2026-10-12T10:00:00Z',
        updated_at: '2026-10-12T10:00:00Z',
        width: 800,
        height: 400,
        notes: null,
        provenance: null,
      },
      content: {
        kind: 'image',
        mediaType: 'image/svg+xml',
        markup: '<svg xmlns="http://www.w3.org/2000/svg"/>',
      },
    })
    replaceMockResearchFigure(MOCK_SVG_FIGURE_ID, {
      kind: 'image',
      mediaType: 'image/svg+xml',
      markup: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"/>',
    })
    await queryClient.invalidateQueries({ queryKey: ['research-figures'] })

    const newMark = await screen.findByTestId('figure-mark-fig_new_drawdown')
    expect(newMark).toHaveTextContent('New')
    expect(screen.getByTestId(`figure-mark-${MOCK_SVG_FIGURE_ID}`)).toHaveTextContent('Updated')
    expect(screen.queryByTestId(`figure-mark-${MOCK_PNG_FIGURE_ID}`)).toBeNull()

    await user.click(await cardFor('Drawdown by month'))

    expect(navigateMock).toHaveBeenCalledWith({
      search: { tab: 'figures', figure: 'fig_new_drawdown' },
    })
    await waitFor(() => {
      expect(screen.queryByTestId('figure-mark-fig_new_drawdown')).toBeNull()
    })
    expect(screen.getByTestId(`figure-mark-${MOCK_SVG_FIGURE_ID}`)).toHaveTextContent('Updated')
  })

  it('opens a card by its figure id', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<FiguresTab />)

    await user.click(await cardFor('Feature correlation'))

    expect(navigateMock).toHaveBeenCalledWith({
      search: { tab: 'figures', figure: MOCK_PLOTLY_FIGURE_ID },
    })
  })
})
