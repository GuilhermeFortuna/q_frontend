import { cn } from '@/lib/utils'
import type { ExitRuleInfo } from '@/types/strategies'
import { groupExitRules } from '@/workspaces/strategy/exitRuleSemantics'

type ExitStrategyCardsProps = {
  rules: ExitRuleInfo[]
  isEnabled: (rule: ExitRuleInfo) => boolean
  onToggle: (rule: ExitRuleInfo) => void
  heading?: string
}

function ExitStrategyCard({
  rule,
  enabled,
  onToggle,
}: {
  rule: ExitRuleInfo
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <article
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
          onClick={onToggle}
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
    </article>
  )
}

export function ExitStrategyCards({
  rules,
  isEnabled,
  onToggle,
  heading = 'Exit Strategies',
}: ExitStrategyCardsProps) {
  if (rules.length === 0) return null

  const groupedRules = groupExitRules(rules)

  return (
    <section className="border-carbon-600/50 bg-carbon-950/30 flex flex-col gap-3 rounded-xl border p-4">
      <h4 className="text-silver-200 text-sm font-medium">{heading}</h4>
      {groupedRules.map(({ group, label, rules: groupRules }) => (
        <div key={group} className="space-y-2">
          <h5 className="text-silver-400 text-xs font-semibold tracking-wide uppercase">{label}</h5>
          <div className="space-y-2">
            {groupRules.map((rule) => (
              <ExitStrategyCard
                key={rule.id}
                rule={rule}
                enabled={isEnabled(rule)}
                onToggle={() => onToggle(rule)}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
