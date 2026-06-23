import type {
  StrategySpec,
  StrategySpecCondition,
  StrategySpecConditionGroup,
} from '@/types/strategyBuilder'

function formatComparison(condition: Extract<StrategySpecCondition, { left: string }>) {
  return `${condition.left} ${condition.op} ${String(condition.right)}`
}

function formatExitPolicy(
  condition: Extract<StrategySpecCondition, { type: 'stop_loss' | 'take_profit' }>,
) {
  const label = condition.type === 'stop_loss' ? 'Stop loss' : 'Take profit'
  const mode = condition.mode === 'percent' ? `${(condition.value * 100).toFixed(1)}%` : 'ATR'
  return `${label} (${mode})`
}

export function formatStrategySpecCondition(condition: StrategySpecCondition): string {
  if ('left' in condition) {
    return formatComparison(condition)
  }
  return formatExitPolicy(condition)
}

export function formatStrategySpecConditionGroup(group: StrategySpecConditionGroup): string[] {
  const branch = group.all ?? group.any ?? []
  const prefix = group.all ? 'ALL' : 'ANY'
  return branch.map((condition) => `${prefix}: ${formatStrategySpecCondition(condition)}`)
}

export function formatStrategySpecIndicators(spec: StrategySpec): string[] {
  return spec.indicators.map((indicator) => {
    const source = indicator.source ? ` on ${indicator.source}` : ''
    const period = indicator.period != null ? ` (${indicator.period})` : ''
    return `${indicator.id}: ${indicator.type}${period}${source}`
  })
}

export function formatStrategySpecRisk(spec: StrategySpec): string {
  if (spec.risk.position_sizing === 'fixed_quantity') {
    return `Fixed quantity: ${spec.risk.quantity ?? 1}`
  }
  return `Safety margin per contract: ${spec.risk.safety_margin_per_contract ?? '—'}`
}

export function formatStrategySpecExecution(spec: StrategySpec): string[] {
  const assumptions = spec.execution_assumptions
  if (!assumptions) return []

  const lines: string[] = []
  if (assumptions.signal_timing) {
    lines.push(`Signal timing: ${assumptions.signal_timing}`)
  }
  if (assumptions.entry_timing) {
    lines.push(`Entry timing: ${assumptions.entry_timing}`)
  }
  lines.push(`Allow short: ${assumptions.allow_short ? 'yes' : 'no'}`)
  if (assumptions.live_trading) {
    lines.push('Live trading requested (not supported in MVP)')
  }
  return lines
}

export function findEditableExitPolicies(spec: StrategySpec) {
  const policies: Array<{
    group: 'entry' | 'exit'
    index: number
    type: 'stop_loss' | 'take_profit'
    value: number
    mode: 'percent' | 'atr'
  }> = []

  for (const group of ['entry', 'exit'] as const) {
    const branch = spec[group].all ?? spec[group].any ?? []
    branch.forEach((condition, index) => {
      if ('type' in condition && condition.mode === 'percent') {
        policies.push({
          group,
          index,
          type: condition.type,
          value: condition.value,
          mode: condition.mode,
        })
      }
    })
  }

  return policies
}
