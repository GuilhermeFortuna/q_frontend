import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { toast, Toaster, type ToastItem } from '@/components/ui/toast'

describe('toast', () => {
  let latest: ToastItem[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    toast.resetForTests()
    latest = []
    toast.subscribe((items) => {
      latest = items
    })
  })

  afterEach(() => {
    toast.resetForTests()
    vi.useRealTimers()
  })

  it('caps visible toasts at three', () => {
    render(<Toaster />)

    act(() => {
      toast.success('one')
      toast.success('two')
      toast.success('three')
      toast.success('four')
    })

    expect(screen.getAllByTestId('toast-success')).toHaveLength(3)
    expect(screen.getByText('four')).toBeInTheDocument()
    expect(screen.queryByText('one')).not.toBeInTheDocument()
    expect(latest).toHaveLength(3)
  })

  it('auto-dismisses success toasts after five seconds', () => {
    render(<Toaster />)

    act(() => {
      toast.success('Saved')
    })

    expect(latest).toHaveLength(1)
    expect(latest[0]?.duration).toBe(5000)

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(latest).toHaveLength(0)
  })

  it('keeps error toasts for eight seconds', () => {
    render(<Toaster />)

    act(() => {
      toast.error('Failed')
    })

    expect(latest[0]?.duration).toBe(8000)

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(latest).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(latest).toHaveLength(0)
  })
})
