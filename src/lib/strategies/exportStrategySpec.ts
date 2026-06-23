import type { StrategySpec } from '@/types/strategyBuilder'

export function downloadStrategySpecJson(spec: StrategySpec, filename?: string) {
  const blob = new Blob([JSON.stringify(spec, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename ?? `${spec.name.replace(/\s+/g, '_') || 'strategy_spec'}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
