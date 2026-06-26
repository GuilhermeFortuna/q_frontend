import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type LabeledFieldProps = {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  labelEnd?: ReactNode
  children: ReactNode
  className?: string
}

export function LabeledField({
  label,
  hint,
  error,
  htmlFor,
  labelEnd,
  children,
  className,
}: LabeledFieldProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <label
        htmlFor={htmlFor}
        className="accent-wayfinding inline-flex items-center gap-1 text-xs font-medium"
      >
        {label}
        {labelEnd}
      </label>
      {hint ? <p className="text-silver-500 text-xs leading-snug">{hint}</p> : null}
      {children}
      {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
    </div>
  )
}
