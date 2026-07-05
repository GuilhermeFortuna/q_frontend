import { useEffect, useState } from 'react'

import { useAppStore } from '@/store/useAppStore'

function readOsReduce(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useReducedMotion(): boolean {
  const motionMode = useAppStore((s) => s.motionMode)
  const [osReduce, setOsReduce] = useState(readOsReduce)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setOsReduce(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return motionMode === 'system' ? osReduce : motionMode !== 'full'
}
