import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { OptimizationWorkbench } from '@/components/optimize/OptimizationWorkbench'

vi.mock('motion/react', () => ({
  motion: {
    div: (
      props: React.HTMLAttributes<HTMLDivElement> & {
        animate?: unknown
        transition?: unknown
        initial?: unknown
      },
    ) => {
      const { children, animate, transition, initial, ...rest } = props
      void animate
      void transition
      void initial
      return <div {...rest}>{children}</div>
    },
  },
}))

describe('OptimizationWorkbench', () => {
  it('renders children when expanded', () => {
    render(
      <OptimizationWorkbench open onOpenChange={vi.fn()}>
        <p>Config content</p>
      </OptimizationWorkbench>,
    )

    expect(screen.getByText('Config content')).toBeInTheDocument()
  })

  it('calls onOpenChange when handle is clicked', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <OptimizationWorkbench open={false} onOpenChange={onOpenChange}>
        <p>Config content</p>
      </OptimizationWorkbench>,
    )

    await user.click(screen.getByRole('button', { name: /expand optimization workbench/i }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('collapses when Escape is pressed while open', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <OptimizationWorkbench open onOpenChange={onOpenChange}>
        <p>Config content</p>
      </OptimizationWorkbench>,
    )

    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('exposes aria-expanded on the handle', () => {
    render(
      <OptimizationWorkbench open={false} onOpenChange={vi.fn()}>
        <p>Config content</p>
      </OptimizationWorkbench>,
    )

    expect(screen.getByRole('button', { name: /expand optimization workbench/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})
