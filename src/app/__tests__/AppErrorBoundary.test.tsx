import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const captureException = vi.hoisted(() => vi.fn())
vi.mock('@sentry/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sentry/react')>()),
  captureException,
}))

import { AppErrorBoundary } from '@/app/AppErrorBoundary'

function BrokenChild(): never {
  throw new Error('render failed')
}

describe('AppErrorBoundary', () => {
  it('renders the fallback and reload action when a child crashes', async () => {
    const user = userEvent.setup()
    const reload = vi.fn()
    render(
      <AppErrorBoundary onReload={reload}>
        <BrokenChild />
      </AppErrorBoundary>,
    )

    expect(screen.getByTestId('app-error-boundary-fallback')).toHaveTextContent(
      'Something broke — the error was reported.',
    )
    await user.click(screen.getByRole('button', { name: 'Reload app' }))
    expect(reload).toHaveBeenCalledOnce()
    expect(captureException).not.toHaveBeenCalled()
  })
})
