import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MorphingDialog, MorphingDialogTrigger } from '@/components/ui/MorphingDialog'
import { useAppStore } from '@/store/useAppStore'

afterEach(() => {
  useAppStore.setState({ motionMode: 'full' })
})

function Harness({
  onCloseAutoFocus,
}: {
  onCloseAutoFocus?: (event: Event) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <MorphingDialogTrigger layoutId="test-morph">
        <button type="button" onClick={() => setOpen(true)}>
          Open morph
        </button>
      </MorphingDialogTrigger>
      <MorphingDialog
        open={open}
        onOpenChange={setOpen}
        layoutId="test-morph"
        title="Inspector"
        description="Candidate summary"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <p>Morph body</p>
        <button type="button">Inside action</button>
      </MorphingDialog>
    </div>
  )
}

describe('MorphingDialog', () => {
  it('opens from the trigger and exposes title/description', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.queryByText('Morph body')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open morph' }))

    expect(await screen.findByTestId('morphing-dialog-content')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Inspector' })).toBeInTheDocument()
    expect(screen.getByText('Candidate summary')).toBeInTheDocument()
    expect(screen.getByText('Morph body')).toBeInTheDocument()
  })

  it('dismisses on Escape and restores via onCloseAutoFocus', async () => {
    const user = userEvent.setup()
    const onCloseAutoFocus = vi.fn((event: Event) => {
      event.preventDefault()
    })
    render(<Harness onCloseAutoFocus={onCloseAutoFocus} />)

    await user.click(screen.getByRole('button', { name: 'Open morph' }))
    expect(await screen.findByText('Morph body')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByText('Morph body')).not.toBeInTheDocument()
    })
    expect(onCloseAutoFocus).toHaveBeenCalled()
  })

  it('closes via the close button', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Open morph' }))
    expect(await screen.findByText('Morph body')).toBeInTheDocument()

    await user.click(screen.getByTestId('morphing-dialog-close'))
    await waitFor(() => {
      expect(screen.queryByText('Morph body')).not.toBeInTheDocument()
    })
  })

  it('traps focus inside the dialog while open', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Open morph' }))
    const close = await screen.findByTestId('morphing-dialog-close')
    expect(close).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Inside action' })).toHaveFocus()
  })

  it('skips shared layoutId under reduced motion', async () => {
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
    const user = userEvent.setup()
    const { container } = render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Open morph' }))
    const content = await screen.findByTestId('morphing-dialog-content')
    expect(content).toBeInTheDocument()
    expect(container.querySelector('[data-layout-id]')).toBeNull()

    window.matchMedia = matchMedia
  })
})
