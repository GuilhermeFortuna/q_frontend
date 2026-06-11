import type { ReactNode } from 'react'

import { usePriceFlash } from '@/hooks/usePriceFlash'

type FlashOnChangeProps = {
  value: number | null | undefined
  className?: string
  children: ReactNode
}

export function FlashOnChange({ value, className = '', children }: FlashOnChangeProps) {
  const { flashClass, flashKey } = usePriceFlash(value)
  const classes = [className, flashClass].filter(Boolean).join(' ')

  return (
    <span key={flashKey} className={classes}>
      {children}
    </span>
  )
}
