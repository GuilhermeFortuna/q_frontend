import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BacktestNotes } from '@/components/backtests/BacktestNotes'

const note = {
  code: 'intrabar_incomplete_ticks',
  message: '412 trades: 397 exits decided on real ticks, 15 at one-minute resolution.',
  details: {},
}

describe('BacktestNotes', () => {
  it('lists each note message under a Notes heading', () => {
    render(<BacktestNotes notes={[note]} />)

    expect(screen.getByRole('region', { name: 'Notes' })).toBeInTheDocument()
    expect(screen.getByText(note.message)).toBeInTheDocument()
  })

  it.each([
    ['an empty list', []],
    ['an absent field', undefined],
    ['null', null],
  ])('renders nothing for %s', (_label, notes) => {
    const { container } = render(<BacktestNotes notes={notes} />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('region', { name: 'Notes' })).not.toBeInTheDocument()
  })
})
