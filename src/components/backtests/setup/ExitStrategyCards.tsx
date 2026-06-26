import { LibraryCard } from '@/components/backtests/setup/LibraryCard'
import { Panel, PanelHeader } from '@/components/ui/Panel'
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
    <Panel living className="flex flex-col gap-3 p-4">
      <PanelHeader title={heading} right={subheading} />
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
    </Panel>
  )
}
