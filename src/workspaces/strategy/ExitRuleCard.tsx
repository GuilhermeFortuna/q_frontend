import { StrategyParamFields } from '@/components/shared/StrategyParamFields'
import { cn } from '@/lib/utils'
import type { StrategyParamValue } from '@/lib/strategies/strategyParams'
import type { ExitRuleInfo, StrategyParamSpec } from '@/types/strategies'
import {
  defaultEnableValue,
  isExitRuleEnabled,
  resolveRuleParamSpecs,
} from '@/workspaces/strategy/exitRuleSemantics'

type ExitRuleCardProps = {
  rule: ExitRuleInfo
  paramSpecs: StrategyParamSpec[]
  paramValues: Record<string, StrategyParamValue>
  onChange: (name: string, value: StrategyParamValue) => void
  cardRef?: (node: HTMLElement | null) => void
}

export function ExitRuleCard({
  rule,
  paramSpecs,
  paramValues,
  onChange,
  cardRef,
}: ExitRuleCardProps) {
  const enabled = isExitRuleEnabled(rule, paramValues)
  const ruleParamSpecs = resolveRuleParamSpecs(rule, paramSpecs)
  const enableSpec = paramSpecs.find((spec) => spec.name === rule.enable_param)

  const handleToggle = () => {
    if (enabled) {
      onChange(rule.enable_param, 0)
      return
    }

    if (!enableSpec) {
      onChange(rule.enable_param, 1)
      return
    }

    onChange(rule.enable_param, defaultEnableValue(enableSpec))
  }

  return (
    <article
      id={`exit-rule-${rule.id}`}
      ref={cardRef}
      className={cn(
        'border-carbon-800/60 rounded-lg border transition-colors',
        enabled ? 'bg-carbon-900/40' : 'bg-carbon-900/15',
      )}
    >
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                enabled ? 'bg-brass-400' : 'bg-carbon-600',
              )}
              aria-hidden
            />
            <h5 className="text-silver-200 text-sm font-medium">{rule.label}</h5>
          </div>
          <p className="text-silver-500 mt-1 text-xs leading-snug">{rule.description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${enabled ? 'Disable' : 'Enable'} ${rule.label}`}
          onClick={handleToggle}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors',
            enabled ? 'border-brass-500/50 bg-brass-500/30' : 'border-carbon-700 bg-carbon-800/80',
          )}
        >
          <span
            className={cn(
              'bg-silver-100 inline-block h-4 w-4 rounded-full transition-transform',
              enabled ? 'translate-x-5' : 'translate-x-1',
            )}
          />
        </button>
      </div>

      {enabled && ruleParamSpecs.length > 0 ? (
        <div className="border-carbon-800/60 border-t px-3 pt-2 pb-3">
          <StrategyParamFields
            params={ruleParamSpecs}
            values={paramValues}
            onChange={onChange}
            className="grid gap-3 sm:grid-cols-2"
            showHints
            hintMode="compact"
          />
        </div>
      ) : null}
    </article>
  )
}
