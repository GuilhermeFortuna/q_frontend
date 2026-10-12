import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const plotly = vi.hoisted(() => ({
  react: vi.fn(
    async (element: HTMLElement, _data?: unknown, _layout?: unknown, _config?: unknown) => element,
  ),
  purge: vi.fn(),
}))

vi.mock('plotly.js-dist-min', () => ({
  default: { react: plotly.react, purge: plotly.purge, downloadImage: vi.fn(async () => '') },
}))

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

import { handlers } from '@/mocks/handlers'
import {
  MOCK_PLOTLY_FIGURE_ID,
  MOCK_PNG_FIGURE_ID,
  MOCK_SVG_FIGURE_ID,
  resetMockResearchFigures,
} from '@/mocks/researchFigures'
import { toast } from '@/components/ui/toast'
import { renderWithQueryClient } from '../../../../../tests/unit/testUtils'
import { FiguresTab } from '../FiguresTab'

const server = setupServer(...handlers)
const requests: Array<{ method: string; url: string }> = []

/** The viewer opens before the list resolves; its actions appear once the figure is loaded. */
async function loadedViewer() {
  const viewer = await screen.findByTestId('figure-viewer')
  await within(viewer).findByRole('button', { name: 'Download' })
  return viewer
}

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
  plotly.react.mockClear()
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('FigureViewer', () => {
  it('opens from the figure id in the URL and shows notes, provenance and position', async () => {
    renderWithQueryClient(<FiguresTab figureId={MOCK_PNG_FIGURE_ID} />)

    const viewer = await loadedViewer()
    expect(
      within(viewer).getByText('Regimes split at ADX 25.', { exact: false }),
    ).toBeInTheDocument()
    expect(within(viewer).getByText('research/rsi_regimes.py')).toBeInTheDocument()
    expect(within(viewer).getByText('9f2c1ab')).toBeInTheDocument()
    expect(within(viewer).getByText('2 / 4')).toBeInTheDocument()
    expect(within(viewer).getByRole('img', { name: 'RSI distribution by regime' })).toHaveAttribute(
      'src',
      expect.stringMatching(/\/content\?rev=1$/),
    )
  })

  it('marks uncommitted provenance on the figure it came from', async () => {
    renderWithQueryClient(<FiguresTab figureId={MOCK_SVG_FIGURE_ID} />)

    const viewer = await loadedViewer()
    expect(within(viewer).getByText('9f2c1ab · uncommitted changes')).toBeInTheDocument()
  })

  it('moves with the arrow keys through the list and closes with Escape', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<FiguresTab figureId={MOCK_PNG_FIGURE_ID} />)
    await loadedViewer()

    await user.keyboard('{ArrowRight}')
    expect(navigateMock).toHaveBeenLastCalledWith({
      search: { tab: 'figures', figure: MOCK_PLOTLY_FIGURE_ID },
    })

    await user.keyboard('{ArrowLeft}')
    await user.keyboard('{ArrowLeft}')
    expect(navigateMock).toHaveBeenLastCalledWith({
      search: { tab: 'figures', figure: MOCK_SVG_FIGURE_ID },
    })

    await user.keyboard('{Escape}')
    expect(navigateMock).toHaveBeenLastCalledWith({ search: { tab: 'figures' } })
  })

  it('an unknown figure id closes the viewer with a notice', async () => {
    const info = vi.spyOn(toast, 'info')
    renderWithQueryClient(<FiguresTab figureId="fig_does_not_exist" />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ search: { tab: 'figures' } })
    })
    expect(info).toHaveBeenCalledWith('That figure is no longer available.')
    // The close animation keeps the dialog mounted briefly.
    await waitFor(() => expect(screen.queryByTestId('figure-viewer')).toBeNull())
    info.mockRestore()
  })

  it('a Plotly figure in the viewer is drawn interactive, with the logo hidden', async () => {
    renderWithQueryClient(<FiguresTab figureId={MOCK_PLOTLY_FIGURE_ID} />)
    await loadedViewer()

    // The grid card also draws a static plot (jsdom has no IntersectionObserver),
    // so select the call that is not static.
    await waitFor(() => {
      const configs = plotly.react.mock.calls.map((call) => call[3] as Record<string, unknown>)
      expect(configs.some((config) => config.staticPlot === undefined)).toBe(true)
    })
    const configs = plotly.react.mock.calls.map((call) => call[3] as Record<string, unknown>)
    const viewerConfig = configs.find((config) => config.staticPlot === undefined)
    expect(viewerConfig).toMatchObject({ responsive: true, displaylogo: false })
  })

  it('image figures toggle between fit and actual size', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<FiguresTab figureId={MOCK_PNG_FIGURE_ID} />)
    const viewer = await loadedViewer()

    await user.click(within(viewer).getByRole('button', { name: 'Actual size' }))

    expect(within(viewer).getByRole('button', { name: 'Fit to area' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(viewer).getByRole('img', { name: 'RSI distribution by regime' })).toHaveClass(
      'max-w-none',
    )
  })

  it('downloads an image figure under a readable file name', async () => {
    const user = userEvent.setup()
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:figure')
    URL.revokeObjectURL = vi.fn()
    const downloads: Array<{ name: string; href: string }> = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push({ name: this.download, href: this.href })
    })

    try {
      renderWithQueryClient(<FiguresTab figureId={MOCK_PNG_FIGURE_ID} />)
      const viewer = await loadedViewer()

      await user.click(within(viewer).getByRole('button', { name: 'Download' }))

      await waitFor(() => expect(downloads).toHaveLength(1))
      expect(downloads[0]).toEqual({ name: 'rsi-distribution-by-regime.png', href: 'blob:figure' })
    } finally {
      click.mockRestore()
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
    }
  })

  it('delete asks for confirmation, removes the figure and moves to the next one', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<FiguresTab figureId={MOCK_PNG_FIGURE_ID} />)
    const viewer = await loadedViewer()

    await user.click(within(viewer).getByRole('button', { name: 'Delete' }))
    expect(screen.getByTestId('confirm-dialog')).toHaveTextContent(
      'Delete “RSI distribution by regime”',
    )
    await user.click(screen.getByTestId('confirm-dialog-confirm'))

    // Navigation is mocked, so the viewer keeps the deleted id; the move is what matters here.
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        search: { tab: 'figures', figure: MOCK_PLOTLY_FIGURE_ID },
      })
    })
    expect(requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'DELETE',
          url: expect.stringContaining(`/api/v1/research/figures/${MOCK_PNG_FIGURE_ID}`),
        }),
      ]),
    )
  })
})
