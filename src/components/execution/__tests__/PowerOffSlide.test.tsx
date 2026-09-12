import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PowerOffSlide } from '@/components/execution/PowerOffSlide'

const reduceMotionState = vi.hoisted(() => ({ value: false }))

vi.mock('@/lib/motion/useReducedMotion', () => ({
  useReducedMotion: () => reduceMotionState.value,
}))

/** Track width 320 → maxTravel = 320 - 44 - 8 = 268; 88% ≈ 235.84 */
const TRACK_WIDTH = 320
const MAX_TRAVEL = TRACK_WIDTH - 44 - 8
const THRESHOLD_OFFSET = Math.ceil(MAX_TRAVEL * 0.88)
const BELOW_OFFSET = Math.floor(MAX_TRAVEL * 0.88) - 1

function mockTrackWidth() {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return (this as HTMLElement).getAttribute('data-testid') === 'power-off-slide-thumb'
        ? 44
        : TRACK_WIDTH
    },
  })
}

function firePointer(
  thumb: HTMLElement,
  type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel',
  clientX: number,
) {
  const event = createEvent[type](thumb, {
    buttons: type === 'pointerUp' || type === 'pointerCancel' ? 0 : 1,
  })
  // jsdom/RTL createEvent omits pointer fields unless assigned explicitly.
  Object.assign(event, { pointerId: 1, clientX, clientY: 20 })
  fireEvent(thumb, event)
}

function dragThumb(thumb: HTMLElement, deltaX: number, options?: { cancel?: boolean }) {
  firePointer(thumb, 'pointerDown', 40)
  firePointer(thumb, 'pointerMove', 40 + deltaX)
  firePointer(thumb, options?.cancel ? 'pointerCancel' : 'pointerUp', 40 + deltaX)
}

describe('PowerOffSlide', () => {
  beforeEach(() => {
    reduceMotionState.value = false
    mockTrackWidth()
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('exposes slider ARIA with valuemin/max/now', () => {
    render(<PowerOffSlide onConfirm={() => undefined} />)
    const thumb = screen.getByRole('slider', { name: /engage global kill switch/i })
    expect(thumb).toHaveAttribute('aria-valuemin', '0')
    expect(thumb).toHaveAttribute('aria-valuemax', '100')
    expect(thumb).toHaveAttribute('aria-valuenow', '0')
  })

  it('does not call onConfirm when released below 88% travel', async () => {
    const onConfirm = vi.fn()
    render(<PowerOffSlide onConfirm={onConfirm} />)
    const thumb = screen.getByTestId('power-off-slide-thumb')

    await act(async () => {
      dragThumb(thumb, BELOW_OFFSET)
    })

    expect(onConfirm).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.getByTestId('power-off-slide')).toHaveAttribute('data-state', 'idle'),
    )
  })

  it('calls onConfirm once when released at or above 88% travel', async () => {
    const onConfirm = vi.fn()
    render(<PowerOffSlide onConfirm={onConfirm} />)
    const thumb = screen.getByTestId('power-off-slide-thumb')

    await act(async () => {
      dragThumb(thumb, THRESHOLD_OFFSET)
    })

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
  })

  it('resets to idle on pointer cancel without confirming', async () => {
    const onConfirm = vi.fn()
    render(<PowerOffSlide onConfirm={onConfirm} />)
    const thumb = screen.getByTestId('power-off-slide-thumb')

    await act(async () => {
      dragThumb(thumb, THRESHOLD_OFFSET, { cancel: true })
    })

    expect(onConfirm).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.getByTestId('power-off-slide')).toHaveAttribute('data-state', 'idle'),
    )
  })

  it('supports keyboard Home/End and confirms with Enter only while armed', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<PowerOffSlide onConfirm={onConfirm} />)
    const thumb = screen.getByRole('slider')

    thumb.focus()
    await user.keyboard('{Enter}')
    expect(onConfirm).not.toHaveBeenCalled()

    await user.keyboard('{End}')
    await waitFor(() => expect(thumb).toHaveAttribute('aria-valuenow', '100'))
    expect(screen.getByTestId('power-off-slide')).toHaveAttribute('data-state', 'armed')

    await user.keyboard('{Enter}')
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))

    await user.keyboard('{Home}')
    // locked in submitting after confirm — Home ignored while locked unless parent clears
  })

  it('Arrow keys adjust intent toward the threshold', async () => {
    const user = userEvent.setup()
    render(<PowerOffSlide onConfirm={() => undefined} />)
    const thumb = screen.getByRole('slider')
    thumb.focus()

    await user.keyboard('{ArrowRight}')
    await waitFor(() => expect(Number(thumb.getAttribute('aria-valuenow'))).toBeGreaterThan(0))

    await user.keyboard('{Home}')
    await waitFor(() => expect(thumb).toHaveAttribute('aria-valuenow', '0'))
  })

  it('locks interaction while submitting and shows awaiting copy', async () => {
    const onConfirm = vi.fn()
    render(<PowerOffSlide onConfirm={onConfirm} submitting />)
    expect(screen.getByTestId('power-off-slide')).toHaveAttribute('data-state', 'submitting')
    expect(screen.getByTestId('power-off-slide-status')).toHaveTextContent(
      /awaiting control plane/i,
    )

    const thumb = screen.getByTestId('power-off-slide-thumb')
    await act(async () => {
      dragThumb(thumb, THRESHOLD_OFFSET)
    })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('resets to idle when rejected rises', async () => {
    const { rerender } = render(<PowerOffSlide onConfirm={() => undefined} rejected={false} />)
    rerender(<PowerOffSlide onConfirm={() => undefined} rejected />)

    await waitFor(() =>
      expect(screen.getByTestId('power-off-slide')).toHaveAttribute('data-state', 'idle'),
    )
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '0')
  })

  it('shows confirmed state when controlled engaged', async () => {
    render(<PowerOffSlide onConfirm={() => undefined} confirmed />)
    await waitFor(() =>
      expect(screen.getByTestId('power-off-slide')).toHaveAttribute('data-state', 'confirmed'),
    )
    expect(screen.getByTestId('power-off-slide-status')).toHaveTextContent(/engaged/i)
  })

  it('keeps threshold and keyboard under reduced motion', async () => {
    reduceMotionState.value = true
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<PowerOffSlide onConfirm={onConfirm} />)

    const thumb = screen.getByRole('slider')
    thumb.focus()
    await user.keyboard('{End}{Enter}')
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))

    const onConfirm2 = vi.fn()
    cleanup()
    render(<PowerOffSlide onConfirm={onConfirm2} />)
    const thumb2 = screen.getByTestId('power-off-slide-thumb')
    await act(async () => {
      dragThumb(thumb2, THRESHOLD_OFFSET)
    })
    await waitFor(() => expect(onConfirm2).toHaveBeenCalledTimes(1))
  })
})
