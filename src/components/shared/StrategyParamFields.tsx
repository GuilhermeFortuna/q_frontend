import { fieldErrorClass, inputClass } from '@/components/shared/InstrumentConfigFields'
import type { StrategyParamValue } from '@/lib/strategies/strategyParams'
import type { StrategyParamSpec } from '@/types/strategies'

type StrategyParamFieldsProps = {
  params: StrategyParamSpec[]
  values: Record<string, StrategyParamValue>
  onChange: (name: string, value: StrategyParamValue) => void
  className?: string
}

export function StrategyParamFields({
  params,
  values,
  onChange,
  className = 'bg-carbon-900/50 border-carbon-600/40 space-y-3 rounded-lg border p-3',
}: StrategyParamFieldsProps) {
  if (params.length === 0) return null

  return (
    <div className={className}>
      {params.map((spec) => {
        const value = values[spec.name] ?? spec.default
        const id = `strategy-param-${spec.name}`

        if (spec.type === 'categorical') {
          const choices = spec.choices ?? []
          return (
            <div key={spec.name} className="space-y-1">
              <label htmlFor={id} className="text-silver-400 text-xs">
                {spec.label}
              </label>
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
            </div>
          )
        }

        const step = spec.step ?? (spec.type === 'int' ? 1 : 'any')
        const numValue = Number(value)
        const belowMin = spec.min != null && numValue < spec.min
        const aboveMax = spec.max != null && numValue > spec.max

        return (
          <div key={spec.name} className="space-y-1">
            <label htmlFor={id} className="text-silver-400 text-xs">
              {spec.label}
            </label>
            <input
              id={id}
              type="number"
              step={step}
              min={spec.min ?? undefined}
              max={spec.max ?? undefined}
              value={numValue}
              onChange={(e) =>
                onChange(
                  spec.name,
                  spec.type === 'int' ? parseInt(e.target.value, 10) : Number(e.target.value),
                )
              }
              className={inputClass}
            />
            {(belowMin || aboveMax) && (
              <p className={fieldErrorClass}>
                {belowMin && spec.min != null
                  ? `Must be at least ${spec.min}.`
                  : `Must be at most ${spec.max}.`}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
