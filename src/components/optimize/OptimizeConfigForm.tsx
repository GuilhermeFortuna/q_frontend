import { useState } from 'react'

import { OptimizeAdvancedSection } from '@/components/optimize/OptimizeAdvancedSection'
import { OptimizeRiskSection } from '@/components/optimize/OptimizeRiskSection'
import { OptimizeStrategySection } from '@/components/optimize/OptimizeStrategySection'
import { OptimizeStudySection } from '@/components/optimize/OptimizeStudySection'
import { Button } from '@/components/ui/button'
import { DISPLAY_TIMEFRAME_OPTIONS, useOptimizeConfig } from '@/lib/optimize/useOptimizeConfig'
import type { OptimizationConfig } from '@/types/optimization'

type OptimizeConfigFormProps = {
  loading: boolean
  error: string | null
  disabled?: boolean
  onSubmit: (config: OptimizationConfig) => void
}

/**
 * Legacy accordion form used by Walk Forward / Discover workbench drawers.
 * The Optimize workspace uses OptimizeSetupPanel instead.
 */
export function OptimizeConfigForm({
  loading,
  error,
  disabled = false,
  onSubmit,
}: OptimizeConfigFormProps) {
  const config = useOptimizeConfig()

  const [strategyOpen, setStrategyOpen] = useState(true)
  const [riskOpen, setRiskOpen] = useState(true)
  const [studyOpen, setStudyOpen] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const { fields, setters, validation } = config
  const primarySlotId = fields.entries[0]?.slotId
  const mergedSearchSpace = {
    ...(primarySlotId ? (fields.entrySearchSpaces[primarySlotId] ?? {}) : {}),
    ...fields.exitSearchSpace,
  }

  const handleLegacySearchSpaceChange = (
    name: string,
    field: Parameters<typeof setters.handleExitSearchSpaceChange>[1],
  ) => {
    const entrySpecs = config.resolveEntryParamSpecs(fields.strategy)
    if (entrySpecs.some((spec) => spec.name === name) && primarySlotId) {
      setters.handleEntrySearchSpaceChange(primarySlotId, name, field)
      return
    }
    setters.handleExitSearchSpaceChange(name, field)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validation.formInvalid || disabled || !config.selectedStrategy) return
    onSubmit(config.buildOptimizationConfig())
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 shrink-0">
        <h2 className="text-brass-400 text-xl font-bold">Optimizer</h2>
        <p className="text-silver-400 mt-1 text-xs">
          Search strategy &amp; risk parameters with Optuna.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-3" noValidate>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          <OptimizeStrategySection
            open={strategyOpen}
            onToggle={() => setStrategyOpen((v) => !v)}
            strategies={config.filteredStrategies}
            strategiesLoading={config.strategiesLoading}
            strategy={fields.strategy}
            onStrategyChange={setters.handleStrategyChange}
            customStrategyNames={config.customStrategyNames}
            engine={fields.engine}
            onEngineChange={setters.handleEngineChange}
            displayTimeframe={fields.displayTimeframe}
            onDisplayTimeframeChange={setters.setDisplayTimeframe}
            tickFlags={fields.tickFlags}
            onTickFlagsChange={setters.setTickFlags}
            displayTimeframeOptions={DISPLAY_TIMEFRAME_OPTIONS}
            searchSpace={mergedSearchSpace}
            onSearchSpaceChange={handleLegacySearchSpaceChange}
            symbol={fields.symbol}
            setSymbol={setters.setSymbol}
            timeframe={fields.timeframe}
            setTimeframe={setters.setTimeframe}
            startDate={fields.startDate}
            setStartDate={setters.setStartDate}
            endDate={fields.endDate}
            setEndDate={setters.setEndDate}
            capital={fields.capital}
            setCapital={setters.setCapital}
            pointValue={fields.pointValue}
            setPointValue={setters.setPointValue}
            dayTrade={fields.dayTrade}
            setDayTrade={setters.setDayTrade}
            dayTradeStartTime={fields.dayTradeStartTime}
            setDayTradeStartTime={setters.setDayTradeStartTime}
            dayTradeEndTime={fields.dayTradeEndTime}
            setDayTradeEndTime={setters.setDayTradeEndTime}
            dayTradeCloseTime={fields.dayTradeCloseTime}
            setDayTradeCloseTime={setters.setDayTradeCloseTime}
          />

          <OptimizeRiskSection
            open={riskOpen}
            onToggle={() => setRiskOpen((v) => !v)}
            riskMode={fields.riskMode}
            setRiskMode={setters.setRiskMode}
            qtyLow={fields.qtyLow}
            qtyHigh={fields.qtyHigh}
            setQtyLow={setters.setQtyLow}
            setQtyHigh={setters.setQtyHigh}
            marginLow={fields.marginLow}
            marginHigh={fields.marginHigh}
            setMarginLow={setters.setMarginLow}
            setMarginHigh={setters.setMarginHigh}
            minContractsLow={fields.minContractsLow}
            minContractsHigh={fields.minContractsHigh}
            setMinContractsLow={setters.setMinContractsLow}
            setMinContractsHigh={setters.setMinContractsHigh}
            targetVolLow={fields.targetVolLow}
            targetVolHigh={fields.targetVolHigh}
            setTargetVolLow={setters.setTargetVolLow}
            setTargetVolHigh={setters.setTargetVolHigh}
            inverseMinContractsLow={fields.inverseMinContractsLow}
            inverseMinContractsHigh={fields.inverseMinContractsHigh}
            setInverseMinContractsLow={setters.setInverseMinContractsLow}
            setInverseMinContractsHigh={setters.setInverseMinContractsHigh}
            inverseMaxContractsInput={fields.inverseMaxContractsInput}
            setInverseMaxContractsInput={setters.setInverseMaxContractsInput}
            costPerContract={fields.costFields.costPerContract}
            setCostPerContract={(value) =>
              setters.setCostFields((current) => ({ ...current, costPerContract: value }))
            }
            costBps={fields.costFields.costBps}
            setCostBps={(value) =>
              setters.setCostFields((current) => ({ ...current, costBps: value }))
            }
            costErrors={validation.costErrors}
          />

          <OptimizeStudySection
            open={studyOpen}
            onToggle={() => setStudyOpen((v) => !v)}
            objective={fields.objective}
            setObjective={setters.setObjective}
            sampler={fields.sampler}
            setSampler={setters.setSampler}
            nTrials={fields.nTrials}
            setNTrials={setters.setNTrials}
            isMultiObjective={validation.isMultiObjective}
          />

          <OptimizeAdvancedSection
            open={advancedOpen}
            onToggle={() => setAdvancedOpen((v) => !v)}
            seed={fields.seed}
            setSeed={setters.setSeed}
            pruner={fields.pruner}
            setPruner={setters.setPruner}
            continueOnTrialError={fields.continueOnTrialError}
            setContinueOnTrialError={setters.setContinueOnTrialError}
            maxWorkersInput={fields.maxWorkersInput}
            onMaxWorkersInputChange={setters.setMaxWorkersInput}
          />
        </div>

        <div className="shrink-0 pt-2">
          <Button
            type="submit"
            disabled={loading || validation.formInvalid || disabled || config.strategiesLoading}
            variant="brass"
            className="w-full"
          >
            {loading ? 'Starting...' : disabled ? 'Study in progress...' : 'Run Optimization'}
          </Button>

          {disabled && !loading && (
            <p className="text-silver-400 mt-2 text-center text-xs">
              Wait for the current study to finish before starting another.
            </p>
          )}

          {error && (
            <div className="mt-3 rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-xs break-words text-rose-400">
              {error}
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
