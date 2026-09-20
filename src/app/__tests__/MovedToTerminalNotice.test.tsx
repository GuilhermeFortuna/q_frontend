import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MovedToTerminalNotice } from '@/app/MovedToTerminalNotice'

describe('MovedToTerminalNotice', () => {
  it('renders the workspace notice on /execution', () => {
    render(<MovedToTerminalNotice context="workspace" />)

    const notice = screen.getByTestId('moved-to-terminal-notice')
    expect(notice).toHaveAttribute('data-moved-context', 'workspace')
    expect(notice).toHaveTextContent(/Execution workspace moved/i)
    expect(notice).toHaveTextContent(/q_terminal/i)
  })

  it('renders the monitor notice for deployment_id windows', () => {
    render(<MovedToTerminalNotice context="monitor" />)

    const notice = screen.getByTestId('moved-to-terminal-notice')
    expect(notice).toHaveAttribute('data-moved-context', 'monitor')
    expect(notice).toHaveTextContent(/Live execution monitor moved/i)
    expect(notice).toHaveTextContent(/q_terminal/i)
  })
})
