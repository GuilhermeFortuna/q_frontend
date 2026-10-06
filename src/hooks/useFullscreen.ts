import { useCallback, useEffect, useRef, useState } from 'react'

export function useFullscreen<T extends HTMLElement = HTMLDivElement>() {
  const elementRef = useRef<T>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === element)
    }

    document.addEventListener('fullscreenchange', syncFullscreenState)
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
      if (element && document.fullscreenElement === element) {
        void document.exitFullscreen().catch(() => undefined)
      }
    }
  }, [])

  const enter = useCallback(async () => {
    const element = elementRef.current
    if (!element?.requestFullscreen) return

    try {
      await element.requestFullscreen()
    } catch {
      // Fullscreen can be denied by the browser or webview. Keep the current layout.
    }
  }, [])

  const exit = useCallback(async () => {
    if (!document.fullscreenElement) return

    try {
      await document.exitFullscreen()
    } catch {
      // The browser may have already left fullscreen.
    }
  }, [])

  return { elementRef, isFullscreen, enter, exit }
}
