import { fieldErrorClass, inputClass } from '@/components/shared/InstrumentConfigFields'
import { LabeledField } from '@/components/ui/LabeledField'
import { NumberInput } from '@/components/ui/number-input'
import { Panel } from '@/components/ui/Panel'
import { paramHint } from '@/lib/strategies/strategyPresentation'
import type { StrategyParamValue } from '@/lib/strategies/strategyParams'
import type { StrategyParamSpec } from '@/types/strategies'

type StrategyParamFieldsProps = {
  params: StrategyParamSpec[]
  values: Record<string, StrategyParamValue>
  onChange: (name: string, value: StrategyParamValue) => void
  className?: string
  /** When true, renders optional param hints beside/below each field. Default false. */
  showHints?: boolean
  /** How hints render when showHints is true. Default 'paragraph'. */
  hintMode?: 'paragraph' | 'compact'
}

function ParamHintCompact({ hint }: { hint: string }) {
  return (
    <span
      className="text-silver-500 ml-1 inline-flex cursor-help align-middle text-[10px]"
      title={hint}
      aria-hidden="true"
    >
      ⓘ
    </span>
  )
}

export function StrategyParamFields({
  params,
  values,
  onChange,
  className = 'space-y-3 p-3',
  showHints = false,
  hintMode = 'paragraph',
}: StrategyParamFieldsProps) {
  if (params.length === 0) return null

  return (
    <Panel className={className}>
      {params.map((spec) => {
        const value = values[spec.name] ?? spec.default
        const id = `strategy-param-${spec.name}`
        const hint = showHints ? paramHint(spec) : null

        if (spec.type === 'categorical') {
          const choices = spec.choices ?? []
          return (
            <LabeledField
              key={spec.name}
              label={spec.label}
              htmlFor={id}
              hint={hint && hintMode === 'paragraph' ? hint : undefined}
              labelEnd={
                hint && hintMode === 'compact' ? <ParamHintCompact hint={hint} /> : undefined
              }
            >
              <select
                id={id}
                value={String(value)}
                onChange={(e) => onChange(spec.name, e.target.value)}
                className={inputClass}
              >
                {choices.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice.toUpperCase()}
                  </option>
                ))}
              </select>
            </LabeledField>
          )
        }

        const step = spec.step ?? (spec.type === 'int' ? 1 : 'any')
        const numValue = Number(value)
        const belowMin = spec.min != null && numValue < spec.min
        const aboveMax = spec.max != null && numValue > spec.max

        return (
          <LabeledField
            key={spec.name}
            label={spec.label}
            htmlFor={id}
            hint={hint && hintMode === 'paragraph' ? hint : undefined}
            labelEnd={hint && hintMode === 'compact' ? <ParamHintCompact hint={hint} /> : undefined}
            error={
              belowMin && spec.min != null
                ? `Must be at least ${spec.min}.`
                : aboveMax && spec.max != null
                  ? `Must be at most ${spec.max}.`
                  : undefined
            }
          >
            <NumberInput
              id={id}
              step={step}
              min={spec.min ?? undefined}
              max={spec.max ?? undefined}
              value={numValue}
              integer={spec.type === 'int'}
              onChange={(next) => onChange(spec.name, next)}
              className={inputClass}
            />
          </LabeledField>
        )
      })}
    </Panel>
  )
}

// Re-export for callers that import fieldErrorClass from this module.
export { fieldErrorClass }
