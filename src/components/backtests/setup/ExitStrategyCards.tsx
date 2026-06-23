import { LibraryCard } from '@/components/backtests/setup/LibraryCard'
import type { ExitGroup, ExitRuleInfo, StrategyParamSpec } from '@/types/strategies'
import {
  EXIT_GROUP_LABELS,
  EXIT_GROUP_OTHER_LABEL,
} from '@/workspaces/strategy/exitWorkbenchGroups'
import { resolveRuleParamSpecs } from '@/workspaces/strategy/exitRuleSemantics'

type ExitStrategyCardsProps = {
  rules: ExitRuleInfo[]
  exitParamSpecs: StrategyParamSpec[]
  isEnabled: (rule: ExitRuleInfo) => boolean
  onToggle: (rule: ExitRuleInfo) => void
  heading?: string
  subheading?: string
}

function ruleGroupLabel(rule: ExitRuleInfo): string {
  if (rule.exit_group in EXIT_GROUP_LABELS) {
    return EXIT_GROUP_LABELS[rule.exit_group as ExitGroup]
  }
  return EXIT_GROUP_OTHER_LABEL
}

export function ExitStrategyCards({
  rules,
  exitParamSpecs,
  isEnabled,
  onToggle,
  heading = 'Exit Strategies',
  subheading,
}: ExitStrategyCardsProps) {
  if (rules.length === 0) return null

  return (
    <section className="border-carbon-600/50 bg-carbon-950/30 flex flex-col gap-3 rounded-xl border p-4">
      <div>
        <h4 className="text-silver-200 text-sm font-medium">{heading}</h4>
        {subheading ? <p className="text-silver-500 mt-1 text-xs">{subheading}</p> : null}
      </div>
      <div className="grid auto-rows-min gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rules.map((rule) => (
          <LibraryCard
            key={rule.id}
            title={rule.label}
            tag={ruleGroupLabel(rule)}
            description={rule.description}
            paramCount={resolveRuleParamSpecs(rule, exitParamSpecs).length}
            selected={isEnabled(rule)}
            onClick={() => onToggle(rule)}
          />
        ))}
      </div>
    </section>
  )
}
