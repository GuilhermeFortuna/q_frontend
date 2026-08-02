import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useFeatureLeaderboard, useFeatureList, useStartFeatureEval } from '@/api/queries/features'
import { FeatureLabCompareView } from '@/components/research/FeatureLabCompareView'
import { FeatureLabFeaturePicker } from '@/components/research/FeatureLabFeaturePicker'
import { FeatureLabInstrumentFields } from '@/components/research/FeatureLabInstrumentFields'
import { wellInputClass } from '@/components/ui/wellInputStyles'
import {
  buildEvalRunRequest,
  evalRunLabel,
  isFeatureLabConfigValid,
  snapshotFromFormState,
  TARGET_FAMILY_OPTIONS,
  type FeatureLabConfigSnapshot,
  type FeatureLabFormState,
  type TargetFamily,
} from '@/components/research/featureLabUtils'
import { Button } from '@/components/ui/button'
import { LabeledField } from '@/components/ui/LabeledField'
import { NumberInput } from '@/components/ui/number-input'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { GlowCard } from '@/components/ui/spotlight-card'
import { defaultBacktestEnd, defaultBacktestStart } from '@/lib/backtesting/dateRange'

export type FeatureLabRecentRun = {
  runId: string
  label: string
}

type FeatureLabProps = {
  onEvalStarted: (runId: string, label: string) => void
  onOpenRun: (runId: string) => void
  recentRuns: FeatureLabRecentRun[]
}

type CompareState = {
  runIdA: string
  runIdB: string
  labelA: string
  labelB: string
} | null

function configToFormState(snapshot: FeatureLabConfigSnapshot): FeatureLabFormState {
  return {
    symbol: snapshot.symbol,
    timeframe: snapshot.timeframe,
    startDate: snapshot.startDate,
    endDate: snapshot.endDate,
    targetName: snapshot.targetName,
    horizon: snapshot.horizon,
    selectedFeatures: new Set(snapshot.featureNames),
  }
}

export function FeatureLab({ onEvalStarted, onOpenRun, recentRuns }: FeatureLabProps) {
  const [formState, setFormState] = useState<FeatureLabFormState>({
    symbol: '',
    timeframe: 'H1',
    startDate: defaultBacktestStart,
    endDate: defaultBacktestEnd,
    targetName: 'fwd_return',
    horizon: 5,
    selectedFeatures: new Set(),
  })
  const [savedSetA, setSavedSetA] = useState<FeatureLabConfigSnapshot | null>(null)
  const [savedSetB, setSavedSetB] = useState<FeatureLabConfigSnapshot | null>(null)
  const [compareState, setCompareState] = useState<CompareState>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const featureListQuery = useFeatureList()
  const leaderboardQuery = useFeatureLeaderboard()
  const startEval = useStartFeatureEval()

  const features = featureListQuery.data?.features ?? []
  const isValid = isFeatureLabConfigValid(formState)
  const isBusy = startEval.isPending

  const updateForm = (patch: Partial<FeatureLabFormState>) => {
    setFormState((current) => ({ ...current, ...patch }))
    setFormError(null)
  }

  // The "recommended" shortcut reflects whatever the latest leaderboard has scored.
  // Empty until at least one evaluation has run — no recommendation is fabricated.
  const recommendedFeatureNames = useMemo(
    () => (leaderboardQuery.data?.features ?? []).map((item) => item.feature_name),
    [leaderboardQuery.data],
  )

  const missingFields = useMemo(() => {
    const missing: string[] = []
    if (formState.symbol.trim().length === 0) missing.push('symbol')
    if (!(formState.startDate < formState.endDate)) missing.push('a valid date range')
    if (formState.horizon < 1) missing.push('a horizon ≥ 1')
    if (formState.selectedFeatures.size === 0) missing.push('at least one feature')
    return missing
  }, [formState])

  const handleEvaluate = async () => {
    if (!isValid || !featureListQuery.data) {
      return
    }

    setFormError(null)
    try {
      const request = buildEvalRunRequest(formState, features)
      const response = await startEval.mutateAsync(request)
      const label = evalRunLabel(snapshotFromFormState(formState))
      onEvalStarted(response.run_id, label)
    } catch {
      setFormError('Failed to start feature evaluation.')
    }
  }

  const handleCompare = async () => {
    if (!savedSetA || !savedSetB || !featureListQuery.data) {
      setFormError('Save both Set A and Set B before comparing.')
      return
    }

    setFormError(null)
    try {
      const requestA = buildEvalRunRequest(configToFormState(savedSetA), features)
      const requestB = buildEvalRunRequest(configToFormState(savedSetB), features)
      const [responseA, responseB] = await Promise.all([
        startEval.mutateAsync(requestA),
        startEval.mutateAsync(requestB),
      ])
      setCompareState({
        runIdA: responseA.run_id,
        runIdB: responseB.run_id,
        labelA: `Set A · ${evalRunLabel(savedSetA)}`,
        labelB: `Set B · ${evalRunLabel(savedSetB)}`,
      })
    } catch {
      setFormError('Failed to compare feature sets.')
    }
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
      data-testid="research-tab-lab"
    >
      <Panel className="flex flex-col gap-4 p-4">
        <SectionHeader title="Feature Lab" />
        <p className="text-silver-400 text-sm">
          Configure a feature evaluation window and target, then hand results to the Scoring
          dashboard.
        </p>

        <div className="grid gap-4 xl:grid-cols-2">
          <FeatureLabInstrumentFields
            symbol={formState.symbol}
            onSymbolChange={(symbol) => updateForm({ symbol })}
            timeframe={formState.timeframe}
            onTimeframeChange={(timeframe) => updateForm({ timeframe })}
            startDate={formState.startDate}
            onStartDateChange={(startDate) => updateForm({ startDate })}
            endDate={formState.endDate}
            onEndDateChange={(endDate) => updateForm({ endDate })}
          />

          <div className="space-y-4">
            <LabeledField label="Prediction target" htmlFor="feature-lab-target">
              <select
                id="feature-lab-target"
                value={formState.targetName}
                onChange={(event) => updateForm({ targetName: event.target.value as TargetFamily })}
                className={wellInputClass}
              >
                {TARGET_FAMILY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </LabeledField>

            <LabeledField label="Horizon (bars)" htmlFor="feature-lab-horizon">
              <NumberInput
                id="feature-lab-horizon"
                value={formState.horizon}
                onChange={(horizon) => updateForm({ horizon })}
                min="1"
                data-testid="feature-lab-horizon"
              />
            </LabeledField>
          </div>
        </div>

        <FeatureLabFeaturePicker
          features={features}
          selectedFeatures={formState.selectedFeatures}
          onChange={(selectedFeatures) => updateForm({ selectedFeatures })}
          recommendedFeatureNames={recommendedFeatureNames}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="brass"
            disabled={!isValid || isBusy}
            onClick={() => void handleEvaluate()}
            data-testid="feature-lab-evaluate"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Evaluate Features
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={!isValid}
            onClick={() => setSavedSetA(snapshotFromFormState(formState))}
            data-testid="feature-lab-save-set-a"
          >
            Save as Set A
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={!isValid}
            onClick={() => setSavedSetB(snapshotFromFormState(formState))}
            data-testid="feature-lab-save-set-b"
          >
            Save as Set B
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={!savedSetA || !savedSetB || isBusy}
            onClick={() => void handleCompare()}
            data-testid="feature-lab-compare"
          >
            Compare Feature Sets
          </Button>
        </div>

        {(savedSetA || savedSetB) && (
          <div className="text-silver-400 grid gap-1 text-xs sm:grid-cols-2">
            <p data-testid="feature-lab-set-a-summary">
              Set A: {savedSetA ? evalRunLabel(savedSetA) : 'not saved'}
            </p>
            <p data-testid="feature-lab-set-b-summary">
              Set B: {savedSetB ? evalRunLabel(savedSetB) : 'not saved'}
            </p>
          </div>
        )}

        {!isValid && missingFields.length > 0 ? (
          <p className="text-silver-400 text-xs" data-testid="feature-lab-missing-fields">
            Set {missingFields.join(', ')} to enable evaluation.
          </p>
        ) : null}

        {formError ? (
          <p className="text-sm text-rose-400" data-testid="feature-lab-error">
            {formError}
          </p>
        ) : null}
      </Panel>

      {compareState ? (
        <FeatureLabCompareView
          runIdA={compareState.runIdA}
          runIdB={compareState.runIdB}
          labelA={compareState.labelA}
          labelB={compareState.labelB}
        />
      ) : null}

      <Panel className="flex flex-col gap-3 p-4">
        <SectionHeader title="Recent runs" />
        {recentRuns.length === 0 ? (
          <p className="text-silver-400 text-sm">No evaluation runs yet.</p>
        ) : (
          <ul className="space-y-2">
            {recentRuns.map((run) => (
              <li key={run.runId}>
                <GlowCard intensity="tile" className="rounded-md">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors"
                    onClick={() => onOpenRun(run.runId)}
                    data-testid={`feature-lab-recent-run-${run.runId}`}
                  >
                    <span className="text-cream-100 font-mono">{run.label}</span>
                    <span className="text-silver-500 text-xs">{run.runId}</span>
                  </button>
                </GlowCard>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

// exported for tests
export function formatFeatureLabDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}
