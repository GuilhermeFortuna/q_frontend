import { Sparkles, SparklesIcon } from 'lucide-react'

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

/**
 * Toggles ambient motion (cinematic particles + panel sheen) between 'full' and 'system'.
 * Default is 'full' so the premium effects show even where WebKitGTK (Tauri desktop) falsely
 * reports `prefers-reduced-motion: reduce`. Switch to 'system' to honor the OS setting.
 */
export function MotionToggle() {
  const motionMode = useAppStore((s) => s.motionMode)
  const setMotionMode = useAppStore((s) => s.setMotionMode)
  const reduced = usePrefersReducedMotion()

  const handleToggle = () => {
    setMotionMode(motionMode === 'full' ? 'system' : 'full')
  }

  const title =
    motionMode === 'full'
      ? 'Ambient motion: Full (click to follow system)'
      : `Ambient motion: Follow system (currently ${reduced ? 'reduced' : 'full'})`

  return (
    <button
      onClick={handleToggle}
      className={cn(
        'surface-control accent-interactive flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border',
        'focus-visible:outline-brass-500 transition-[transform,box-shadow] duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95',
      )}
      title={title}
      aria-label="Toggle ambient motion"
      aria-pressed={motionMode === 'full'}
    >
      {motionMode === 'full' ? (
        <Sparkles className="text-brass-400 h-4 w-4 transition-transform duration-300" />
      ) : (
        <SparklesIcon className="text-silver-400 h-4 w-4 opacity-60 transition-transform duration-300" />
      )}
    </button>
  )
}
