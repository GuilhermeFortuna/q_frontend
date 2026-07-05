import { Slot } from '@radix-ui/react-slot'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

import { cn } from '@/lib/utils'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'ghost' | 'outline' | 'brass'
  size?: 'sm' | 'md' | 'lg'
  asChild?: boolean
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  default: 'surface-suede text-silver-100',
  ghost:
    'bg-transparent text-silver-300 hover:bg-carbon-800/80 hover:text-silver-100 border border-transparent shadow-none',
  outline:
    'bg-transparent text-silver-300 border border-white/10 hover:border-brass-600 hover:text-brass-400 shadow-none',
  brass: 'button-machined-brass',
}

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-[550]',
          'transition-[transform,opacity,background-color,border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-exit)]',
          'hover:duration-[var(--motion-base)] hover:ease-[var(--ease-out)]',
          'active:translate-y-[0.5px] active:scale-[0.985] active:duration-[var(--motion-fast)] active:ease-[var(--ease-out)]',
          variant === 'default' ? 'surface-suede' : undefined,
          'focus-visible:outline-brass-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          'disabled:pointer-events-none disabled:scale-100 disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    )
  },
)

Button.displayName = 'Button'
