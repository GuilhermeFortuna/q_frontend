import { cn } from '@/lib/utils'

type QuantEmblemProps = {
  className?: string
}

export function QuantEmblem({ className }: QuantEmblemProps) {
  return (
    <img
      src="/quant.svg"
      alt=""
      className={cn(
        'h-14 w-14 shrink-0 select-none',
        'drop-shadow-[0_0_10px_color-mix(in_srgb,var(--color-gold-400)_28%,transparent)]',
        className,
      )}
      aria-hidden
      draggable={false}
    />
  )
}
