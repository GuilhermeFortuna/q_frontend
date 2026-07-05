import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/Dialog'

describe('Dialog', () => {
  it('opens and closes via trigger', async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger asChild>
          <button type="button">Open</button>
        </DialogTrigger>
        <DialogContent size="sm">
          <DialogHeader title="Test dialog" />
          <p>Dialog body</p>
        </DialogContent>
      </Dialog>,
    )

    expect(screen.queryByText('Dialog body')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByText('Dialog body')).toBeInTheDocument()
  })

  it('dismisses on Escape', async () => {
    const user = userEvent.setup()

    render(
      <Dialog defaultOpen>
        <DialogContent size="sm">
          <DialogHeader title="Dismissible" />
          <p>Escape me</p>
        </DialogContent>
      </Dialog>,
    )

    expect(screen.getByText('Escape me')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByText('Escape me')).not.toBeInTheDocument()
    })
  })
})

describe('ConfirmDialog', () => {
  it('preserves the exported API and testids', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <ConfirmDialog
        open
        title="Delete run?"
        description="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    expect(screen.getByText('Delete run?')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()

    await user.click(screen.getByTestId('confirm-dialog-cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)

    await user.click(screen.getByTestId('confirm-dialog-confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
