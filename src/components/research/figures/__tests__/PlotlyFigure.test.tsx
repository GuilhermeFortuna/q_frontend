import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const plotly = vi.hoisted(() => ({
  loads: 0,
  react: vi.fn(async (element: HTMLElement) => element),
  purge: vi.fn(),
}))

// The chunk is counted when the dynamic import runs: this module factory executes once.
vi.mock('plotly.js-dist-min', () => {
  plotly.loads += 1
  return { default: { react: plotly.react, purge: plotly.purge } }
})

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

import { handlers } from '@/mocks/handlers'
import { MOCK_PLOTLY_FIGURE_ID, resetMockResearchFigures } from '@/mocks/researchFigures'
import { renderWithQueryClient } from '../../../../../tests/unit/testUtils'
import { FiguresTab } from '../FiguresTab'

const server = setupServer(...handlers)
const contentRequests: string[] = []

type MockObserver = {
  callback: IntersectionObserverCallback
  targets: Element[]
}

let observers: MockObserver[] = []

class MockIntersectionObserver {
  private readonly record: MockObserver

  constructor(callback: IntersectionObserverCallback) {
    this.record = { callback, targets: [] }
    observers.push(this.record)
  }

  observe(target: Element) {
    this.record.targets.push(target)
  }

  unobserve(target: Element) {
    this.record.targets = this.record.targets.filter((item) => item !== target)
  }

  disconnect() {
    observers = observers.filter((item) => item !== this.record)
  }

  takeRecords() {
    return []
  }
}

/** Moves every observed element in or out of view, as scrolling would. */
function setInView(isIntersecting: boolean) {
  act(() => {
    for (const observer of [...observers]) {
      const entries = observer.targets.map(
        (target) => ({ isIntersecting, target }) as unknown as IntersectionObserverEntry,
      )
      observer.callback(entries, observer as unknown as IntersectionObserver)
    }
  })
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
  server.events.on('request:start', ({ request }) => {
    if (request.url.includes('/content')) contentRequests.push(request.url)
  })
})
beforeEach(() => {
  resetMockResearchFigures()
  observers = []
  contentRequests.length = 0
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})
afterEach(() => {
  server.resetHandlers()
  vi.unstubAllGlobals()
})
afterAll(() => server.close())

describe('Plotly figures', () => {
  // This test must run first in the file: the chunk loads once per module instance.
  it('does not request the Plotly chunk when no Plotly figure is on screen', async () => {
    renderWithQueryClient(<FiguresTab />)
    const user = userEvent.setup()
    await user.click(await screen.findByTestId('figure-collection-momentum-study'))

    await screen.findByRole('button', { name: 'Walk-forward equity (SVG)' })
    expect(plotly.loads).toBe(0)
    expect(plotly.react).not.toHaveBeenCalled()
  })

  it('loads content and mounts a static plot when the card scrolls into view, and purges it when it leaves', async () => {
    renderWithQueryClient(<FiguresTab />)
    const card = await screen.findByTestId(`figure-card-${MOCK_PLOTLY_FIGURE_ID}`)
    expect(within(card).getByText('Interactive figure')).toBeInTheDocument()
    expect(contentRequests).toHaveLength(0)

    setInView(true)

    await waitFor(() => expect(plotly.react).toHaveBeenCalledTimes(1))
    const [element, data, , config] = plotly.react.mock.calls[0] as unknown as [
      HTMLElement,
      Array<Record<string, unknown>>,
      unknown,
      { staticPlot?: boolean },
    ]
    expect(element.isConnected).toBe(true)
    expect(data[0]).toMatchObject({ type: 'heatmap' })
    expect(config).toMatchObject({ staticPlot: true, displaylogo: false })
    expect(contentRequests.some((url) => url.includes(`${MOCK_PLOTLY_FIGURE_ID}/content`))).toBe(
      true,
    )

    setInView(false)

    expect(plotly.purge).toHaveBeenCalledWith(element)
  })
})
