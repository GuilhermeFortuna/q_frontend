import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { QuantNumberFlow } from '@/components/ui/QuantNumberFlow'
import { useAppStore } from '@/store/useAppStore'

afterEach(() => {
  useAppStore.setState({ motionMode: 'full' })
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => false,
  })
})

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function flowText(container: HTMLElement): string {
  return (
    container.querySelector('[data-quant-number-flow-text]')?.textContent ??
    container.querySelector('[data-quant-number-flow]')?.getAttribute('aria-label') ??
    ''
  )
}

describe('QuantNumberFlow', () => {
  it('formats positive, negative, decimal, grouped, and unit values via the caller formatter', () => {
    const { container, rerender } = render(
      <QuantNumberFlow value={1234.5} format={(v) => v.toFixed(2)} />,
    )
    expect(flowText(container)).toBe('1234.50')

    rerender(<QuantNumberFlow value={-42.25} format={(v) => v.toFixed(2)} />)
    expect(flowText(container)).toBe('-42.25')

    rerender(
      <QuantNumberFlow value={1_250_000} format={(v) => v.toLocaleString('en-US')} />,
    )
    expect(flowText(container)).toBe('1,250,000')

    rerender(<QuantNumberFlow value={24} format={(v) => `${v}%`} />)
    expect(flowText(container)).toBe('24%')

    rerender(<QuantNumberFlow value={1200} format={formatUsd} />)
    expect(flowText(container)).toBe('$1,200')
  })

  it('exposes one final formatted string for accessibility and copy text', () => {
    const { container } = render(
      <QuantNumberFlow value={98.6} format={(v) => `${v.toFixed(1)}%`} />,
    )

    const root = container.querySelector('[data-quant-number-flow]') as HTMLElement
    expect(root).toHaveAttribute('aria-label', '98.6%')
    expect(root.querySelector('[aria-hidden="true"]')).toBeTruthy()
    expect(flowText(container)).toBe('98.6%')
    expect(screen.getByLabelText('98.6%')).toBe(root)
  })

  it('renders an em dash for non-finite input without announcing a false value', () => {
    const { container, rerender } = render(
      <QuantNumberFlow value={Number.NaN} format={(v) => String(v)} />,
    )
    const root = container.querySelector('[data-quant-number-flow]') as HTMLElement
    expect(flowText(container)).toBe('—')
    expect(root).not.toHaveAttribute('aria-label')
    expect(root).not.toHaveAttribute('data-value')

    rerender(<QuantNumberFlow value={Number.POSITIVE_INFINITY} format={(v) => String(v)} />)
    expect(flowText(container)).toBe('—')
    expect(root).not.toHaveAttribute('aria-label')
  })

  it('keeps unchanged values stable and follows rise/fall updates', () => {
    const { container, rerender } = render(
      <QuantNumberFlow value={10} format={(v) => String(v)} ariaLabel="n" />,
    )
    expect(screen.getByLabelText('n')).toHaveAttribute('data-value', '10')
    expect(flowText(container)).toBe('10')

    rerender(<QuantNumberFlow value={10} format={(v) => String(v)} ariaLabel="n" />)
    expect(screen.getByLabelText('n')).toHaveAttribute('data-value', '10')
    expect(flowText(container)).toBe('10')

    rerender(<QuantNumberFlow value={15} format={(v) => String(v)} ariaLabel="n" />)
    expect(screen.getByLabelText('n')).toHaveAttribute('data-value', '15')
    expect(flowText(container)).toBe('15')

    rerender(<QuantNumberFlow value={7} format={(v) => String(v)} ariaLabel="n" />)
    expect(screen.getByLabelText('n')).toHaveAttribute('data-value', '7')
    expect(flowText(container)).toBe('7')
  })

  it('converges on the newest value under rapid updates without queuing stale ticks', () => {
    const { container, rerender } = render(
      <QuantNumberFlow value={1} format={(v) => String(v)} ariaLabel="rapid" />,
    )

    act(() => {
      rerender(<QuantNumberFlow value={2} format={(v) => String(v)} ariaLabel="rapid" />)
      rerender(<QuantNumberFlow value={3} format={(v) => String(v)} ariaLabel="rapid" />)
      rerender(<QuantNumberFlow value={9} format={(v) => String(v)} ariaLabel="rapid" />)
    })

    expect(screen.getByLabelText('rapid')).toHaveAttribute('data-value', '9')
    expect(flowText(container)).toBe('9')
  })

  it('snaps instantly under reduced motion', () => {
    const matchMedia = window.matchMedia
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia

    act(() => {
      useAppStore.setState({ motionMode: 'system' })
    })
    const { container, rerender } = render(
      <QuantNumberFlow value={1} format={(v) => String(v)} ariaLabel="rm" />,
    )
    act(() => {
      rerender(<QuantNumberFlow value={8} format={(v) => String(v)} ariaLabel="rm" />)
    })
    expect(screen.getByLabelText('rm')).toHaveAttribute('data-value', '8')
    expect(flowText(container)).toBe('8')

    window.matchMedia = matchMedia
  })

  it('snaps instantly when the document tab is hidden', () => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    })
    const { container, rerender } = render(
      <QuantNumberFlow value={1} format={(v) => String(v)} ariaLabel="hidden" />,
    )
    rerender(<QuantNumberFlow value={4} format={(v) => String(v)} ariaLabel="hidden" />)
    expect(screen.getByLabelText('hidden')).toHaveAttribute('data-value', '4')
    expect(flowText(container)).toBe('4')
  })

  it('clamps durationMs to the 120..280 window without throwing', () => {
    expect(() =>
      render(
        <QuantNumberFlow
          value={3}
          format={(v) => String(v)}
          durationMs={40}
          ariaLabel="clamp-low"
        />,
      ),
    ).not.toThrow()
    expect(() =>
      render(
        <QuantNumberFlow
          value={3}
          format={(v) => String(v)}
          durationMs={900}
          ariaLabel="clamp-high"
        />,
      ),
    ).not.toThrow()
  })
})
