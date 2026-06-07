import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

const BRANDED_BG = '/Quant_Background.jpeg'
const CLEAN_BG = '/Quant_Background_clean.jpeg'

export function QuantBackground() {
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)
  const isLauncher = activeWorkspace === 'launcher'

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div
        className={cn(
          'absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-500',
          isLauncher ? 'opacity-100' : 'opacity-0',
        )}
        style={{ backgroundImage: `url('${BRANDED_BG}')` }}
      />
      <div
        className={cn(
          'absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-500',
          isLauncher ? 'opacity-0' : 'opacity-100',
        )}
        style={{ backgroundImage: `url('${CLEAN_BG}')` }}
      />
    </div>
  )
}
