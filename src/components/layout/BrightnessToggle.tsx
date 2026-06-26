import { Sun, SunDim, SunMoon } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useResolvedBrightness } from '@/hooks/useResolvedBrightness'
import { cn } from '@/lib/utils'

export function BrightnessToggle() {
  const brightnessMode = useAppStore((s) => s.brightnessMode)
  const setBrightnessMode = useAppStore((s) => s.setBrightnessMode)
  const resolvedBrightness = useResolvedBrightness()

  const handleToggle = () => {
    let nextMode: 'high' | 'mid' | 'auto'
    if (brightnessMode === 'high') {
      nextMode = 'mid'
    } else if (brightnessMode === 'mid') {
      nextMode = 'auto'
    } else {
      nextMode = 'high'
    }
    setBrightnessMode(nextMode)
  }

  const getIcon = () => {
    if (brightnessMode === 'auto') {
      return <SunMoon className="text-brass-400 h-4 w-4 transition-transform duration-300" />
    }
    if (brightnessMode === 'high') {
      return (
        <Sun className="text-brass-400 h-4 w-4 transition-transform duration-300 hover:rotate-45" />
      )
    }
    return <SunDim className="text-brass-400 h-4 w-4 transition-transform duration-300" />
  }

  const getTitle = () => {
    const resolvedLabel =
      resolvedBrightness === 'low' ? 'low (falls back to mid)' : resolvedBrightness
    const capitalizedResolved = resolvedLabel.charAt(0).toUpperCase() + resolvedLabel.slice(1)
    if (brightnessMode === 'auto') {
      return `Brightness: Auto (Currently: ${capitalizedResolved})`
    }
    return `Brightness: ${capitalizedResolved}`
  }

  return (
    <button
      onClick={handleToggle}
      className={cn(
        'surface-control accent-interactive flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border',
        'focus-visible:outline-brass-500 transition-[transform,box-shadow] duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95',
      )}
      title={getTitle()}
      aria-label="Toggle brightness mode"
    >
      {getIcon()}
    </button>
  )
}
