import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button } from '@/components/ui/button'

describe('Button typography & motion', () => {
  it('does not contain the no-op cubic-bezier string class', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: /click me/i })

    // Ensure the bug class is gone
    const classList = Array.from(button.classList)
    const containsCubicBezier = classList.some((c) => c.includes('cubic-bezier'))
    expect(containsCubicBezier).toBe(false)
  })

  it('applies the standardized active press transforms', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: /click me/i })

    // Check for standardized active classes
    expect(button).toHaveClass('active:scale-[0.985]')
    expect(button).toHaveClass('active:translate-y-[0.5px]')
    expect(button).toHaveClass('duration-[var(--motion-fast)]')
    expect(button).toHaveClass('ease-[var(--ease-exit)]')
    expect(button).toHaveClass('hover:duration-[var(--motion-base)]')
    expect(button).toHaveClass('hover:ease-[var(--ease-out)]')
  })

  it('renders correct material classes for default and brass variants', () => {
    const { rerender } = render(<Button variant="default">Click me</Button>)
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toHaveClass('surface-suede')

    rerender(<Button variant="brass">Click me</Button>)
    expect(button).toHaveClass('button-machined-brass')
  })
})
