import type { GeneticSearchConfig, LockboxConfig } from '@/types/strategySearch'
import { DEFAULT_GENETIC_CONFIG, DEFAULT_LOCKBOX_CONFIG } from '@/types/strategySearch'

import { FormSection, inputClass } from '@/components/optimize/optimizeFormShared'
import { LabeledField } from '@/components/ui/LabeledField'
import { NumberInput } from '@/components/ui/number-input'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'

type DiscoverGeneticSectionProps = {
  geneticOpen: boolean
  onToggleGenetic: () => void
  lockboxOpen: boolean
  onToggleLockbox: () => void
  genetic: GeneticSearchConfig
  setGenetic: React.Dispatch<React.SetStateAction<GeneticSearchConfig>>
  lockbox: LockboxConfig
  setLockbox: React.Dispatch<React.SetStateAction<LockboxConfig>>
  geneticError: string | null
  lockboxError: string | null
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  id,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  id: string
}) {
  return (
    <LabeledField label={label} htmlFor={id}>
      <NumberInput
        id={id}
        className={inputClass}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
      />
    </LabeledField>
  )
}

export function DiscoverGeneticSection({
  geneticOpen,
  onToggleGenetic,
  lockboxOpen,
  onToggleLockbox,
  genetic,
  setGenetic,
  lockbox,
  setLockbox,
  geneticError,
  lockboxError,
}: DiscoverGeneticSectionProps) {
  const useLockboxDays = lockbox.lockbox_days != null
  const lockboxMode = useLockboxDays ? 'days' : 'percent'

  return (
    <>
      <FormSection title="Genetic algorithm" open={geneticOpen} onToggle={onToggleGenetic}>
        <p className="text-silver-400 mb-3 text-xs leading-normal">
          Evolves novel <span className="text-brass-400 font-mono">CompositeStrategy</span> genomes;
          each genome is walk-forward optimized and ranked on OOS robustness.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id="genetic-population-size"
            label="Population size"
            value={genetic.population_size}
            min={10}
            max={200}
            onChange={(value) => setGenetic((current) => ({ ...current, population_size: value }))}
          />
          <NumberField
            id="genetic-generations"
            label="Generations"
            value={genetic.generations}
            min={2}
            max={50}
            onChange={(value) => setGenetic((current) => ({ ...current, generations: value }))}
          />
          <NumberField
            id="genetic-elite-count"
            label="Elite count"
            value={genetic.elite_count}
            min={1}
            onChange={(value) => setGenetic((current) => ({ ...current, elite_count: value }))}
          />
          <NumberField
            id="genetic-tournament-size"
            label="Tournament size"
            value={genetic.tournament_size}
            min={2}
            onChange={(value) => setGenetic((current) => ({ ...current, tournament_size: value }))}
          />
          <NumberField
            id="genetic-crossover-rate"
            label="Crossover rate"
            value={genetic.crossover_rate}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => setGenetic((current) => ({ ...current, crossover_rate: value }))}
          />
          <NumberField
            id="genetic-mutation-rate"
            label="Mutation rate"
            value={genetic.mutation_rate}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => setGenetic((current) => ({ ...current, mutation_rate: value }))}
          />
          <NumberField
            id="genetic-max-nodes"
            label="Max nodes"
            value={genetic.max_nodes}
            min={4}
            onChange={(value) => setGenetic((current) => ({ ...current, max_nodes: value }))}
          />
          <NumberField
            id="genetic-max-depth"
            label="Max depth"
            value={genetic.max_depth}
            min={3}
            onChange={(value) => setGenetic((current) => ({ ...current, max_depth: value }))}
          />
          <NumberField
            id="genetic-init-seed"
            label="Init seed (optional)"
            value={genetic.init_seed ?? DEFAULT_GENETIC_CONFIG.init_seed ?? 42}
            onChange={(value) => setGenetic((current) => ({ ...current, init_seed: value }))}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NumberField
            id="genetic-complexity-lambda"
            label="Complexity λ (nodes)"
            value={genetic.complexity_lambda}
            min={0}
            step={0.0001}
            onChange={(value) =>
              setGenetic((current) => ({ ...current, complexity_lambda: value }))
            }
          />
          <NumberField
            id="genetic-complexity-mu"
            label="Complexity μ (params)"
            value={genetic.complexity_mu}
            min={0}
            step={0.0001}
            onChange={(value) => setGenetic((current) => ({ ...current, complexity_mu: value }))}
          />
        </div>
        {geneticError ? <p className="mt-2 text-xs text-rose-400">{geneticError}</p> : null}
        <p className="text-silver-400 mt-3 text-[11px] leading-normal">
          Will evaluate{' '}
          <span className="text-brass-400 font-mono font-bold">
            {genetic.population_size * genetic.generations}
          </span>{' '}
          genomes ({genetic.population_size} × {genetic.generations} generations).
        </p>
      </FormSection>

      <FormSection title="Advanced › Lock-box" open={lockboxOpen} onToggle={onToggleLockbox}>
        <label className="text-silver-200 mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={lockbox.enabled}
            onChange={(event) =>
              setLockbox((current) => ({ ...current, enabled: event.target.checked }))
            }
            className="accent-brass-500 h-4 w-4 rounded"
          />
          Reserve a held-out tail for one-shot champion evaluation
        </label>
        {lockbox.enabled ? (
          <div className="space-y-3">
            <LabeledField label="Lockbox sizing">
              <SegmentedToggle
                aria-label="Lockbox sizing mode"
                value={lockboxMode}
                onChange={(mode) => {
                  if (mode === 'days') {
                    setLockbox((current) => ({
                      ...current,
                      lockbox_pct: null,
                      lockbox_days: current.lockbox_days ?? 30,
                    }))
                  } else {
                    setLockbox((current) => ({
                      ...current,
                      lockbox_pct: current.lockbox_pct ?? DEFAULT_LOCKBOX_CONFIG.lockbox_pct,
                      lockbox_days: null,
                    }))
                  }
                }}
                options={[
                  { value: 'percent', label: 'By percent' },
                  { value: 'days', label: 'By days' },
                ]}
              />
            </LabeledField>
            {useLockboxDays ? (
              <NumberField
                id="lockbox-days"
                label="Lock-box days"
                value={lockbox.lockbox_days ?? 30}
                min={1}
                onChange={(value) =>
                  setLockbox((current) => ({ ...current, lockbox_days: value, lockbox_pct: null }))
                }
              />
            ) : (
              <NumberField
                id="lockbox-pct"
                label="Lock-box fraction"
                value={lockbox.lockbox_pct ?? DEFAULT_LOCKBOX_CONFIG.lockbox_pct ?? 0.15}
                min={0.01}
                max={0.5}
                step={0.01}
                onChange={(value) =>
                  setLockbox((current) => ({
                    ...current,
                    lockbox_pct: value,
                    lockbox_days: null,
                  }))
                }
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                id="lockbox-min-trades"
                label="Min lock-box trades"
                value={lockbox.min_trades}
                min={0}
                onChange={(value) => setLockbox((current) => ({ ...current, min_trades: value }))}
              />
              <LabeledField label="Max lock-box drawdown (optional)" htmlFor="lockbox-max-dd">
                <NumberInput
                  id="lockbox-max-dd"
                  className={inputClass}
                  nullable
                  value={lockbox.max_drawdown_pct ?? null}
                  min={0}
                  max={1}
                  step={0.01}
                  placeholder="—"
                  onChange={(value) =>
                    setLockbox((current) => ({
                      ...current,
                      max_drawdown_pct: value,
                    }))
                  }
                />
              </LabeledField>
            </div>
          </div>
        ) : null}
        {lockboxError ? <p className="mt-2 text-xs text-rose-400">{lockboxError}</p> : null}
      </FormSection>
    </>
  )
}

export type SearchMode = 'registry' | 'genetic'

export function SearchModeToggle({
  mode,
  onChange,
}: {
  mode: SearchMode
  onChange: (mode: SearchMode) => void
}) {
  return (
    <SegmentedToggle
      aria-label="Search mode"
      value={mode}
      onChange={onChange}
      className="w-full"
      options={[
        { value: 'registry', label: 'Registry sweep' },
        { value: 'genetic', label: 'Genetic synthesis' },
      ]}
    />
  )
}
