import { useEffect, useState } from 'react'

const ZOOM_KEY = 'quant-app-zoom'
const DEFAULT_ZOOM = 1.0
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.0
const ZOOM_STEP = 0.05 // 5% increments

export function useGlobalZoom() {
  const [zoom, setZoom] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(ZOOM_KEY)
      return stored ? parseFloat(stored) : DEFAULT_ZOOM
    } catch {
      return DEFAULT_ZOOM
    }
  })

  // Apply zoom to documentElement style
  useEffect(() => {
    try {
      const target = document.documentElement
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(target.style as any).zoom = zoom.toString()
    } catch (err) {
      console.error('Failed to set zoom level:', err)
    }
  }, [zoom])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl key (or Cmd on Mac)
      const isCtrl = e.ctrlKey || e.metaKey
      if (!isCtrl) return

      let handled = false
      let nextZoom = zoom

      if (e.key === '=' || e.key === '+' || e.key === 'Add') {
        nextZoom = Math.min(MAX_ZOOM, zoom + ZOOM_STEP)
        handled = true
      } else if (e.key === '-' || e.key === 'Subtract') {
        nextZoom = Math.max(MIN_ZOOM, zoom - ZOOM_STEP)
        handled = true
      } else if (e.key === '0') {
        nextZoom = DEFAULT_ZOOM
        handled = true
      }

      if (handled) {
        e.preventDefault()
        setZoom(nextZoom)
        try {
          localStorage.setItem(ZOOM_KEY, nextZoom.toString())
        } catch (err) {
          console.error('Failed to persist zoom level:', err)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zoom])

  return zoom
}
