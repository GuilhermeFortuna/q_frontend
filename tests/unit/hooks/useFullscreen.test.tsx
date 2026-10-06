import { act, render } from '@testing-library/react'
import { useFullscreen } from '@/hooks/useFullscreen'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fullscreenElementDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement')
const exitFullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'exitFullscreen')

afterEach(() => {
  vi.restoreAllMocks()
  if (fullscreenElementDescriptor) {
    Object.defineProperty(document, 'fullscreenElement', fullscreenElementDescriptor)
  } else {
    Reflect.deleteProperty(document, 'fullscreenElement')
  }
  if (exitFullscreenDescriptor) {
    Object.defineProperty(document, 'exitFullscreen', exitFullscreenDescriptor)
  } else {
    Reflect.deleteProperty(document, 'exitFullscreen')
  }
})

describe('useFullscreen', () => {
  it('tracks fullscreen changes for its element and exits on request', async () => {
    let fullscreen: ReturnType<typeof useFullscreen<HTMLDivElement>> | undefined
    function Harness() {
      fullscreen = useFullscreen<HTMLDivElement>()
      return <div ref={fullscreen.elementRef} />
    }

    render(<Harness />)
    const element = fullscreen!.elementRef.current!
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(element, 'requestFullscreen', { value: requestFullscreen })
    let fullscreenElement: Element | null = null
    const exitFullscreen = vi.fn(async () => {
      fullscreenElement = null
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreen,
    })
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    })

    await act(async () => {
      await fullscreen!.enter()
    })
    expect(requestFullscreen).toHaveBeenCalledOnce()
    expect(fullscreen!.isFullscreen).toBe(false)

    await act(async () => {
      fullscreenElement = element
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    expect(fullscreen!.isFullscreen).toBe(true)

    await act(async () => {
      await fullscreen!.exit()
    })
    expect(exitFullscreen).toHaveBeenCalledOnce()
    expect(fullscreen!.isFullscreen).toBe(false)
  })

  it('does not fail when fullscreen is unavailable or denied', async () => {
    let fullscreen: ReturnType<typeof useFullscreen<HTMLDivElement>> | undefined
    function Harness() {
      fullscreen = useFullscreen<HTMLDivElement>()
      return <div ref={fullscreen.elementRef} />
    }

    render(<Harness />)

    await expect(fullscreen!.enter()).resolves.toBeUndefined()
    Object.defineProperty(fullscreen!.elementRef.current!, 'requestFullscreen', {
      value: vi.fn().mockRejectedValue(new Error('denied')),
    })
    await expect(fullscreen!.enter()).resolves.toBeUndefined()
    expect(fullscreen!.isFullscreen).toBe(false)
  })
})
