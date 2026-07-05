import { cn } from '@/lib/utils'

export const chipBaseClass =
  'surface-suede rounded-md border px-2.5 py-1 text-xs font-semibold transition-[transform,border-color,box-shadow,background-color] duration-[var(--motion-fast)] ease-[var(--ease-exit)] hover:duration-[var(--motion-base)] hover:ease-[var(--ease-out)] active:scale-[0.985] active:translate-y-[0.5px] active:duration-[var(--motion-fast)] active:ease-[var(--ease-out)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-500'

export function chipClass(active: boolean, className?: string) {
  return cn(
    chipBaseClass,
    active ? 'accent-state text-gold-400' : 'text-silver-300 hover:border-brass-500/40',
    className,
  )
}
