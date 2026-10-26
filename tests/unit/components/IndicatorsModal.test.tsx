import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { createElement, type ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { IndicatorsModal } from '@/components/charts/IndicatorsModal'
import { handlers } from '@/mocks/handlers'
import { mockIndicatorCatalog } from '@/mocks/marketIndicators'
import type { IndicatorConfig } from '@/lib/market/indicatorConfig'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderModal(indicators: IndicatorConfig[] = []) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }

  const onChange = vi.fn()
  const onClose = vi.fn()
  const view = render(
    <IndicatorsModal isOpen indicators={indicators} onClose={onClose} onChange={onChange} />,
    {
      wrapper: Wrapper,
    },
  )
  return { ...view, onChange, onClose, queryClient }
}

describe('IndicatorsModal', () => {
  it('lists every backend catalog entry in the picker', async () => {
    renderModal()

    await waitFor(() => {
      expect(screen.getByTestId('indicator-catalog-item-sma')).toBeInTheDocument()
    })

    for (const entry of mockIndicatorCatalog.indicators) {
      expect(screen.getByTestId(`indicator-catalog-item-${entry.id}`)).toBeInTheDocument()
    }
  })

  it('preserves parameter edits and enabled selections while browsing', async () => {
    const user = userEvent.setup()
    const { onChange } = renderModal()
    const period = await screen.findByRole('spinbutton')
    fireEvent.change(period, { target: { value: '35' } })
    await user.click(screen.getByRole('checkbox', { name: 'Enable SMA' }))
    await user.click(screen.getByTestId('indicator-catalog-item-rsi'))
    await user.click(screen.getByTestId('indicator-catalog-item-sma'))
    expect(screen.getByRole('spinbutton')).toHaveValue(35)
    await user.click(screen.getByRole('button', { name: /Apply/ }))
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'sma', enabled: true, parameters: { period: 35 } }),
    ])
  })

  it('provides a readable guide and parameter help for the inspected indicator', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(await screen.findByTestId('indicator-catalog-item-rolling_rank'))
    await user.click(screen.getByRole('tab', { name: 'Guide' }))
    expect(screen.getByRole('heading', { name: 'What it measures' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Calculation' })).toBeInTheDocument()
    expect(screen.getByText(/count.*close.*window/i)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Settings' }))
    expect(screen.getByRole('spinbutton', { name: /Window/ })).toBeInTheDocument()
    expect(screen.queryByText(/Instance key:/)).not.toBeInTheDocument()
  })

  it('keeps both tab-panel targets present and navigates tabs with the keyboard', async () => {
    const user = userEvent.setup()
    renderModal()
    await screen.findByTestId('indicator-catalog-item-sma')
    const settings = screen.getByRole('tab', { name: 'Settings' })
    const guide = screen.getByRole('tab', { name: 'Guide' })
    expect(document.getElementById(guide.getAttribute('aria-controls')!)).toBeInTheDocument()
    settings.focus()
    await user.keyboard('{ArrowRight}')
    expect(guide).toHaveFocus()
    expect(guide).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Home}')
    expect(settings).toHaveFocus()
  })

  it('keeps unknown configurations and additional instances when applying', async () => {
    const unknown: IndicatorConfig = { id: 'future_indicator', enabled: true, parameters: {} }
    const second: IndicatorConfig = { id: 'sma', enabled: true, parameters: { period: 50 } }
    const { onChange } = renderModal([
      { id: 'sma', enabled: true, parameters: { period: 20 } },
      second,
      unknown,
    ])
    await screen.findByTestId('indicator-catalog-item-sma')
    await userEvent.click(screen.getByRole('button', { name: /Apply/ }))
    expect(onChange.mock.calls[0][0]).toEqual(expect.arrayContaining([second, unknown]))
  })

  it('commits configured disabled indicators without filling the selection with untouched defaults', async () => {
    const user = userEvent.setup()
    const { onChange } = renderModal()
    fireEvent.change(await screen.findByRole('spinbutton', { name: 'Period' }), {
      target: { value: '35' },
    })
    await user.click(screen.getByRole('button', { name: 'Blue color' }))
    await user.click(screen.getByRole('button', { name: 'Apply changes' }))
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'sma',
        enabled: false,
        parameters: { period: 35 },
        style: expect.objectContaining({ color: '#6eb5ff' }),
      }),
    ])
  })

  it('keeps additional enabled instances discoverable in the enabled filter', async () => {
    const user = userEvent.setup()
    renderModal([
      { id: 'sma', enabled: false, parameters: { period: 20 } },
      { id: 'sma', enabled: true, parameters: { period: 50 } },
    ])
    await screen.findByTestId('indicator-catalog-item-sma')
    await user.click(screen.getByRole('button', { name: 'Enabled 1' }))
    expect(screen.getByTestId('indicator-catalog-item-sma')).toBeInTheDocument()
    expect(screen.getByText('1 additional enabled')).toBeInTheDocument()
  })

  it('keeps drafts on catalog refresh, blocks invalid settings, and resets defaults', async () => {
    const user = userEvent.setup()
    const { queryClient, onChange } = renderModal()
    fireEvent.change(await screen.findByRole('spinbutton', { name: 'Period' }), {
      target: { value: '1.5' },
    })
    await user.click(screen.getByRole('checkbox', { name: 'Enable SMA' }))
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled()
    queryClient.setQueryData(['market-indicators', 'catalog'], {
      ...mockIndicatorCatalog,
      indicators: [...mockIndicatorCatalog.indicators],
    })
    await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveValue(1.5))
    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }))
    expect(screen.getByRole('spinbutton')).toHaveValue(20)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('saves RSI levels as display settings and blocks an oversold level above overbought', async () => {
    const user = userEvent.setup()
    const { onChange } = renderModal()
    await user.click(await screen.findByTestId('indicator-catalog-item-rsi'))
    fireEvent.change(await screen.findByRole('spinbutton', { name: 'Overbought level' }), {
      target: { value: '80' },
    })
    await user.click(screen.getByRole('button', { name: 'Apply changes' }))
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'rsi',
        parameters: { period: 20 },
        style: { overboughtLevel: 80 },
      }),
    ])

    onChange.mockClear()
    await user.click(screen.getByRole('checkbox', { name: 'Enable RSI' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Oversold level' }), {
      target: { value: '85' },
    })
    expect(screen.getByRole('spinbutton', { name: 'Oversold level' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled()
  })

  it('clears search and filters enabled indicators without discarding drafts', async () => {
    const user = userEvent.setup()
    renderModal([{ id: 'sma', enabled: true, parameters: { period: 20 } }])
    await screen.findByTestId('indicator-catalog-item-sma')
    await user.type(screen.getByRole('searchbox'), 'no such indicator')
    expect(screen.getByText('No indicators found.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    await user.click(screen.getByRole('button', { name: /Enabled/ }))
    expect(screen.getByTestId('indicator-catalog-item-sma')).toBeInTheDocument()
    expect(screen.queryByTestId('indicator-catalog-item-rsi')).not.toBeInTheDocument()
  })
})
