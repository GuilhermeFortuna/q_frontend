import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EntryManagerSelector } from '@/components/backtests/setup/EntryManagerSelector'
import { mockSignalManagers } from '@/mocks/data'
import type { EntryManagerState } from '@/lib/backtesting/entryInstances'

describe('EntryManagerSelector', () => {
  it('reveals vote_threshold for majority and clamps to instance count', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <EntryManagerSelector
        managers={mockSignalManagers.managers}
        value={{ kind: 'or', params: {} }}
        onChange={onChange}
        instanceCount={2}
      />,
    )

    expect(screen.queryByRole('spinbutton', { name: 'Vote Threshold' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Majority vote' }))

    expect(onChange).toHaveBeenCalledWith({
      kind: 'majority',
      params: { vote_threshold: 2 },
    })

    const { rerender } = render(
      <EntryManagerSelector
        managers={mockSignalManagers.managers}
        value={{ kind: 'majority', params: { vote_threshold: 2 } }}
        onChange={onChange}
        instanceCount={2}
      />,
    )

    const voteField = screen.getByRole('spinbutton', { name: 'Vote Threshold' })
    expect(voteField).toHaveAttribute('max', '2')

    rerender(
      <EntryManagerSelector
        managers={mockSignalManagers.managers}
        value={{ kind: 'majority', params: { vote_threshold: 2 } }}
        onChange={onChange}
        instanceCount={1}
      />,
    )

    expect(screen.getByRole('spinbutton', { name: 'Vote Threshold' })).toHaveAttribute('max', '1')
  })

  it('switches between OR and AND without extra params', async () => {
    const user = userEvent.setup()
    let value: EntryManagerState = { kind: 'or', params: {} }
    const onChange = (next: EntryManagerState) => {
      value = next
    }

    const { rerender } = render(
      <EntryManagerSelector
        managers={mockSignalManagers.managers}
        value={value}
        onChange={onChange}
        instanceCount={3}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'All (AND)' }))
    rerender(
      <EntryManagerSelector
        managers={mockSignalManagers.managers}
        value={value}
        onChange={onChange}
        instanceCount={3}
      />,
    )

    expect(value.kind).toBe('and')
    expect(screen.queryByRole('spinbutton', { name: 'Vote Threshold' })).not.toBeInTheDocument()
  })
})
