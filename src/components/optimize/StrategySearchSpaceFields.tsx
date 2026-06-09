import {
  fieldErrorClass,
  labelClass,
  panelClass,
  RangeRow,
} from '@/components/optimize/optimizeFormShared'
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
    <div className={panelClass}>
      {params.map((spec) => {
        const field = state[spec.name]
        if (!field) return null

        if (field.kind === 'categorical') {
          const choices = spec.choices ?? []
          const invalid = field.choices.length === 0
          return (
            <div key={spec.name} className="space-y-1">
              <label className={labelClass}>{spec.label}</label>
              <div className="flex flex-wrap gap-1.5">
                {choices.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() =>
                      onChange(spec.name, {
                        kind: 'categorical',
                        choices: toggleChoice(choice, field.choices),
                      })
                    }
                    className={
                      field.choices.includes(choice)
                        ? 'text-brass-400 border-brass-500/50 rounded border px-2 py-0.5 text-xs font-medium'
                        : 'text-silver-300 border-carbon-600/60 hover:border-brass-500/50 rounded border px-2 py-0.5 text-xs font-medium'
                    }
                  >
                    {choice.toUpperCase()}
                  </button>
                ))}
              </div>
              {invalid && (
                <p className={fieldErrorClass}>Select at least one option for {spec.label}.</p>
              )}
            </div>
          )
        }

        const step = spec.step ?? (spec.type === 'int' ? '1' : 'any')
        return (
          <RangeRow
            key={spec.name}
            label={spec.label}
            low={field.low}
            high={field.high}
            setLow={(low) => onChange(spec.name, { kind: 'numeric', low, high: field.high })}
            setHigh={(high) => onChange(spec.name, { kind: 'numeric', low: field.low, high })}
            step={String(step)}
          />
        )
      })}
    </div>
  )
}
