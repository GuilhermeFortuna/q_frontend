import { useEffect, useRef, useState } from 'react'

export type PriceFlashDirection = 'up' | 'down' | null

export function usePriceFlash(value: number | null | undefined) {
  const prevRef = useRef<number | null>(null)
  const [direction, setDirection] = useState<PriceFlashDirection>(null)
  const [flashKey, setFlashKey] = useState(0)

  useEffect(() => {
    if (value == null || Number.isNaN(value)) {
      return
    }

    const prev = prevRef.current
    if (prev != null && value !== prev) {
      setDirection(value > prev ? 'up' : 'down')
      setFlashKey((key) => key + 1)

      const timer = window.setTimeout(() => {
        setDirection(null)
      }, 600)

      prevRef.current = value
      return () => window.clearTimeout(timer)
    }

    prevRef.current = value
  }, [value])

  const flashClass =
    direction === 'up' ? 'price-flash-up' : direction === 'down' ? 'price-flash-down' : ''

  return { direction, flashClass, flashKey }
}
