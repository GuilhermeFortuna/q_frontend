import { cn } from '@/lib/utils'

export const chipBaseClass =
  'surface-card rounded-md border px-2.5 py-1 text-xs font-semibold transition-[border-color,box-shadow,transform] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-500'

export function chipClass(active: boolean, className?: string) {
  return cn(
    chipBaseClass,
    active
      ? 'accent-state text-gold-400'
      : 'text-silver-300 hover:border-brass-500/40 active:scale-95',
    className,
  )
}
