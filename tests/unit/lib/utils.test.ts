import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/utils'

describe('cn', () => {
  it('merges tailwind classes and resolves conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-silver-100', false && 'hidden', 'font-mono')).toBe('text-silver-100 font-mono')
  })
})
