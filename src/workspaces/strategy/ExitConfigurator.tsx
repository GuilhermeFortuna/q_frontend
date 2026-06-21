import { useCallback, useMemo, useRef } from 'react'

import { StrategyParamFields } from '@/components/shared/StrategyParamFields'
import { cn } from '@/lib/utils'
import type { StrategyParamValue } from '@/lib/strategies/strategyParams'
import type { ExitPreset, ExitRuleInfo, StrategyParamSpec } from '@/types/strategies'
import { EXIT_GROUP_LABELS } from '@/workspaces/strategy/exitWorkbenchGroups'
import { ExitRuleCard } from '@/workspaces/strategy/ExitRuleCard'
import {
  buildClearAllExitUpdates,
  getEnabledExitRules,
  getVisibleSharedParamNames,
  groupExitRules,
} from '@/workspaces/strategy/exitRuleSemantics'

type ExitConfiguratorProps = {
  exitRules: ExitRuleInfo[]
  sharedExitParams: string[]
  exitPresets: ExitPreset[]
  exitParamSpecs: StrategyParamSpec[]
  paramValues: Record<string, StrategyParamValue>
  onChange: (name: string, value: StrategyParamValue) => void
  onParamsMerge: (updates: Record<string, StrategyParamValue>) => void
}

export function ExitConfigurator({
  exitRules,
  sharedExitParams,
  exitPresets,
  exitParamSpecs,
  paramValues,
  onChange,
  onParamsMerge,
}: ExitConfiguratorProps) {
  const cardRefs = useRef<Record<string, HTMLElement | null>>({})
  const groupedRules = useMemo(() => groupExitRules(exitRules), [exitRules])
  const enabledRules = useMemo(
    () => getEnabledExitRules(exitRules, paramValues),
    [exitRules, paramValues],
  )
  const visibleSharedParams = useMemo(
    () => getVisibleSharedParamNames(exitRules, paramValues, sharedExitParams),
    [exitRules, paramValues, sharedExitParams],
  )

  const sharedParamSpecs = useMemo(
    () => exitParamSpecs.filter((spec) => visibleSharedParams.includes(spec.name)),
    [exitParamSpecs, visibleSharedParams],
  )

  const scrollToRule = useCallback((ruleId: string) => {
    const node = cardRefs.current[ruleId]
    node?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const handleClearAll = () => {
    onParamsMerge(buildClearAllExitUpdates(exitRules))
  }

  const handleApplyPreset = (preset: ExitPreset) => {
    onParamsMerge(preset.parameters)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-silver-500 font-mono text-[10px] tracking-wider uppercase">
            Active:
          </span>
          {enabledRules.length === 0 ? (
            <span className="text-silver-500 text-xs italic">
              No exits enabled — pick a preset or toggle one on.
            </span>
          ) : (
            enabledRules.map((rule) => (
              <button
                key={rule.id}
                type="button"
                onClick={() => scrollToRule(rule.id)}
                className="border-brass-500/30 bg-brass-500/10 text-brass-300 hover:bg-brass-500/20 rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
              >
                {rule.label}
              </button>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-silver-500 font-mono text-[10px] tracking-wider uppercase">
            Presets:
          </span>
          {exitPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              onClick={() => handleApplyPreset(preset)}
              className="border-carbon-700 bg-carbon-900/50 text-silver-300 hover:border-brass-600/40 hover:bg-carbon-800/60 rounded-md border px-2.5 py-1 text-[11px]"
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClearAll}
            className="text-silver-500 hover:text-silver-300 ml-auto text-[11px] underline-offset-2 hover:underline"
          >
            Clear all exits
          </button>
        </div>
      </div>

      {visibleSharedParams.length > 0 ? (
        <section className="bg-carbon-900/20 border-carbon-800/40 rounded-lg border p-4">
          <h4 className="text-silver-300 mb-3 text-xs font-semibold tracking-wider uppercase">
            {EXIT_GROUP_LABELS.general}
          </h4>
          <StrategyParamFields
            params={sharedParamSpecs}
            values={paramValues}
            onChange={onChange}
            className="grid gap-3 sm:grid-cols-2"
            showHints
            hintMode="compact"
          />
        </section>
      ) : null}

      {groupedRules.map(({ group, label, rules }) => (
        <section
          key={group}
          className={cn('bg-carbon-900/20 border-carbon-800/40 rounded-lg border p-4')}
        >
          <h4 className="text-silver-300 mb-3 text-xs font-semibold tracking-wider uppercase">
            {label}
          </h4>
          <div className="space-y-2">
            {rules.map((rule) => (
              <ExitRuleCard
                key={rule.id}
                rule={rule}
                paramSpecs={exitParamSpecs}
                paramValues={paramValues}
                onChange={onChange}
                cardRef={(node) => {
                  cardRefs.current[rule.id] = node
                }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
