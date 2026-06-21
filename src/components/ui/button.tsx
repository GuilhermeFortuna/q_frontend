import { Slot } from '@radix-ui/react-slot'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

import { cn } from '@/lib/utils'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'ghost' | 'outline' | 'brass'
  size?: 'sm' | 'md' | 'lg'
  asChild?: boolean
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  default:
    'bg-carbon-800 text-silver-100 hover:bg-carbon-700 border border-carbon-700/80 hover:border-carbon-600 shadow-[0_1px_2px_rgba(0,0,0,0.2)]',
  ghost: 'bg-transparent text-silver-300 hover:bg-carbon-800/80 hover:text-silver-100',
  outline:
    'bg-transparent text-silver-300 border border-carbon-700 hover:border-brass-600 hover:text-brass-400',
  brass:
    'bg-gradient-to-r from-brass-600/20 to-brass-500/10 text-brass-400 border border-brass-600/40 hover:from-brass-500/30 hover:to-brass-400/15 hover:border-brass-500/70 hover:text-cream-200 shadow-[0_2px_12px_-3px_rgba(196,165,116,0.15)]',
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
          'cubic-bezier(0.16,1,0.3,1) inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[transform,opacity,background-color,border-color] duration-350',
          'focus-visible:outline-brass-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          'hover:scale-[1.01] active:scale-[0.97] disabled:pointer-events-none disabled:scale-100 disabled:opacity-50',
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
