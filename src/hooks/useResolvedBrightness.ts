import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'

export type ResolvedBrightnessMode = 'high' | 'mid' | 'low'

export function useResolvedBrightness(): ResolvedBrightnessMode {
  const brightnessMode = useAppStore((s) => s.brightnessMode)
  const highStart = useAppStore((s) => s.autoBrightnessHighStart)
  const midStart = useAppStore((s) => s.autoBrightnessMidStart)
  const lowStart = useAppStore((s) => s.autoBrightnessLowStart)

  const [currentHour, setCurrentHour] = useState(() => new Date().getHours())

  useEffect(() => {
    if (brightnessMode !== 'auto') return

    const updateTime = () => {
      setCurrentHour(new Date().getHours())
    }

    const interval = setInterval(updateTime, 15000) // check every 15 seconds
    return () => clearInterval(interval)
  }, [brightnessMode])

  if (brightnessMode !== 'auto') {
    return brightnessMode
  }

  // Auto Mode Logic:
  // High: [highStart, midStart)
  // Mid: [midStart, lowStart)
  // Low: [lowStart, 24) or [0, highStart)
  if (currentHour >= highStart && currentHour < midStart) {
    return 'high'
  } else if (currentHour >= midStart && currentHour < lowStart) {
    return 'mid'
  } else {
    return 'low'
  }
}
