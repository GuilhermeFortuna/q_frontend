import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CalloutType = 'info' | 'warning' | 'error' | 'success'

export type CalloutProps = {
  type?: CalloutType
  title?: string
  children: ReactNode
  action?: ReactNode
  className?: string
} & ComponentPropsWithoutRef<'div'>

const icons = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle2,
}

const styles = {
  info: {
    container: 'border-l-brass-500/80 bg-brass-500/5 text-silver-300 border-carbon-700/60',
    title: 'text-brass-400',
    icon: 'text-brass-400',
  },
  warning: {
    container: 'border-l-brass-500 bg-brass-500/10 text-silver-200 border-brass-500/20',
    title: 'text-brass-400',
    icon: 'text-brass-400',
  },
  error: {
    container: 'border-l-rose-500 bg-rose-500/10 text-rose-300 border-rose-500/20',
    title: 'text-rose-400',
    icon: 'text-rose-400',
  },
  success: {
    container: 'border-l-emerald-500 bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    title: 'text-emerald-400',
    icon: 'text-emerald-400',
  },
}

export function Callout({
  type = 'info',
  title,
  children,
  action,
  className,
  ...rest
}: CalloutProps) {
  const Icon = icons[type]
  const typeStyles = styles[type]

  return (
    <div
      {...rest}
      className={cn(
        'relative flex items-start gap-3.5 rounded-lg border border-l-4 p-4 shadow-sm backdrop-blur-xs transition-colors duration-[var(--motion-base)]',
        typeStyles.container,
        className,
      )}
    >
      <Icon className={cn('mt-0.5 h-4.5 w-4.5 shrink-0', typeStyles.icon)} />
      <div className="min-w-0 flex-1">
        {title && (
          <h5
            className={cn('mb-1 text-xs font-semibold tracking-wider uppercase', typeStyles.title)}
          >
            {title}
          </h5>
        )}
        <div className="text-xs leading-relaxed">{children}</div>
        {action && <div className="mt-3.5">{action}</div>}
      </div>
    </div>
  )
}
