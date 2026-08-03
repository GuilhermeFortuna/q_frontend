import { Component, useState, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FeatureIslandBoundary } from '@/components/islands/FeatureIslandBoundary'

vi.mock('@/components/status/FaultyTerminalField', () => ({
  FaultyTerminalField: () => (
    <div data-testid="faulty-terminal-field" aria-hidden="true" />
  ),
}))

class ThrowingChild extends Component<{ shouldThrow: boolean; children?: ReactNode }> {
  render() {
    if (this.props.shouldThrow) {
      throw new Error('chunk load failed')
    }
    return <div data-testid="island-ok">{this.props.children ?? 'loaded'}</div>
  }
}

function RetryHarness({ label = 'performance charts' }: { label?: string }) {
  const [resetKey, setResetKey] = useState(0)
  const [shouldThrow, setShouldThrow] = useState(true)

  return (
    <FeatureIslandBoundary
      label={label}
      resetKey={resetKey}
      onRetry={() => {
        setShouldThrow(false)
        setResetKey((k) => k + 1)
      }}
    >
      <ThrowingChild shouldThrow={shouldThrow} />
    </FeatureIslandBoundary>
  )
}

describe('FeatureIslandBoundary (WO219)', () => {
  it('renders compact OperationalFailureState when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <FeatureIslandBoundary label="performance charts" onRetry={vi.fn()}>
        <ThrowingChild shouldThrow />
      </FeatureIslandBoundary>,
    )

    const alert = screen.getByTestId('feature-island-error')
    expect(alert).toHaveAttribute('data-compact', 'true')
    expect(alert).toHaveTextContent('Couldn’t load performance charts.')
    expect(screen.getByTestId('faulty-terminal-field')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    spy.mockRestore()
  })

  it('clears the error and remounts children when resetKey changes via retry', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<RetryHarness />)

    expect(screen.getByTestId('feature-island-error')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /retry/i }))

    expect(screen.getByTestId('island-ok')).toHaveTextContent('loaded')
    expect(screen.queryByTestId('feature-island-error')).not.toBeInTheDocument()
    expect(screen.queryByTestId('faulty-terminal-field')).not.toBeInTheDocument()
    spy.mockRestore()
  })

  it('renders children when no error has occurred', () => {
    render(
      <FeatureIslandBoundary label="charts">
        <div data-testid="island-ok">healthy</div>
      </FeatureIslandBoundary>,
    )
    expect(screen.getByTestId('island-ok')).toBeInTheDocument()
    expect(screen.queryByTestId('feature-island-error')).not.toBeInTheDocument()
  })
})
