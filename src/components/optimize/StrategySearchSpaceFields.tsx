import { LabeledField } from '@/components/ui/LabeledField'
import { Panel } from '@/components/ui/Panel'
import { RangeInput } from '@/components/ui/RangeInput'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import type { SearchSpaceFieldState } from '@/lib/strategies/strategyParams'
import type { StrategyParamSpec } from '@/types/strategies'

type StrategySearchSpaceFieldsProps = {
  params: StrategyParamSpec[]
  state: Record<string, SearchSpaceFieldState>
  onChange: (name: string, field: SearchSpaceFieldState) => void
}

function toggleChoice(choice: string, list: string[]): string[] {
  return list.includes(choice) ? list.filter((v) => v !== choice) : [...list, choice]
}

export function StrategySearchSpaceFields({
  params,
  state,
  onChange,
}: StrategySearchSpaceFieldsProps) {
  if (params.length === 0) return null

  return (
    <Panel className="space-y-3 p-3">
      {params
        .filter((spec) => spec.searchable !== false)
        .map((spec) => {
          const field = state[spec.name]
          if (!field) return null

          if (field.kind === 'categorical') {
            const choices = spec.choices ?? []
            const invalid = field.choices.length === 0
            return (
              <LabeledField
                key={spec.name}
                label={spec.label}
                error={invalid ? `Select at least one option for ${spec.label}.` : undefined}
              >
                <SegmentedToggle
                  mode="multi"
                  aria-label={spec.label}
                  options={choices.map((choice) => ({
                    value: choice,
                    label: choice.toUpperCase(),
                  }))}
                  values={field.choices}
                  onToggle={(choice) =>
                    onChange(spec.name, {
                      kind: 'categorical',
                      choices: toggleChoice(choice, field.choices),
                    })
                  }
                />
              </LabeledField>
            )
          }

          const intOnly = spec.type === 'int'
          const label =
            spec.search_scale === 'log' ? (
              <span className="inline-flex items-center gap-1.5">
                {spec.label}
                <span className="accent-wayfinding rounded border px-1 py-px text-[10px] font-medium tracking-wide uppercase">
                  log
                </span>
              </span>
            ) : (
              spec.label
            )

          return (
            <LabeledField
              key={spec.name}
              label={typeof label === 'string' ? label : spec.label}
              labelEnd={
                typeof label !== 'string' ? (
                  <span className="accent-wayfinding rounded border px-1 py-px text-[10px] font-medium tracking-wide uppercase">
                    log
                  </span>
                ) : undefined
              }
            >
              <RangeInput
                min={field.low}
                max={field.high}
                step={field.step ?? null}
                intOnly={intOnly}
                onChange={({ min, max, step }) =>
                  onChange(spec.name, { ...field, kind: 'numeric', low: min, high: max, step })
                }
              />
            </LabeledField>
          )
        })}
      <p className="text-silver-400 text-xs">
        Step controls the sampling grid for each parameter. Coarser steps keep values clean and
        reduce overfitting; leave a float step blank for a continuous range.
      </p>
    </Panel>
  )
}
