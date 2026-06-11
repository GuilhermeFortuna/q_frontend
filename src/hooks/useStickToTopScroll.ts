import { useEffect, useRef, useState } from 'react'

const TOP_THRESHOLD_PX = 5

export function useStickToTopScroll(itemCount: number) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isAtTop, setIsAtTop] = useState(true)
  const [pendingNew, setPendingNew] = useState(0)
  const prevCountRef = useRef(itemCount)

  useEffect(() => {
    const delta = itemCount - prevCountRef.current
    if (delta > 0) {
      if (isAtTop) {
        const element = scrollRef.current
        if (element) {
          if (typeof element.scrollTo === 'function') {
            element.scrollTo({ top: 0 })
          } else {
            element.scrollTop = 0
          }
        }
      } else {
        setPendingNew((count) => count + delta)
      }
    }
    prevCountRef.current = itemCount
  }, [itemCount, isAtTop])

  const handleScroll = () => {
    const element = scrollRef.current
    if (!element) return

    const atTop = element.scrollTop <= TOP_THRESHOLD_PX
    setIsAtTop(atTop)
    if (atTop) {
      setPendingNew(0)
    }
  }

  const jumpToTop = () => {
    const element = scrollRef.current
    if (element) {
      if (typeof element.scrollTo === 'function') {
        element.scrollTo({ top: 0 })
      } else {
        element.scrollTop = 0
      }
    }
    setPendingNew(0)
    setIsAtTop(true)
  }

  return { scrollRef, pendingNew, isAtTop, handleScroll, jumpToTop }
}
