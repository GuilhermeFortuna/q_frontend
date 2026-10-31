import { useState, type FormEvent } from 'react'

import { replayErrorMessage, useStartReplay, type ReplayStartPhase } from '@/api/queries/replay'
import { Button } from '@/components/ui/button'
import { LabeledField } from '@/components/ui/LabeledField'
import { wellInputClass } from '@/components/ui/wellInputStyles'
import {
  buildReplayPlan,
  EMPTY_REPLAY_FORM,
  type FormErrors,
  type ReplayForm,
} from '@/workspaces/replay/replayControls'

const PHASE_TEXT: Record<ReplayStartPhase, string> = {
  freezing: 'Freezing the TickStore range…',
  starting: 'Starting the paused run…',
}

/** Start a replay from a symbol, a date range, the capital and the instrument's point value. */
export function ReplayStartForm() {
  const [values, setValues] = useState<ReplayForm>(EMPTY_REPLAY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [phase, setPhase] = useState<ReplayStartPhase | null>(null)
  const start = useStartReplay()

  const update = (field: keyof ReplayForm) => (event: { target: { value: string } }) =>
    setValues((previous) => ({ ...previous, [field]: event.target.value }))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const { plan, errors: problems } = buildReplayPlan(values)
    setErrors(problems)
    if (!plan) return
    setPhase('freezing')
    start.mutate(
      { freeze: plan.freeze, datasetId: plan.datasetId, run: plan.run, onPhase: setPhase },
      { onSettled: () => setPhase(null) },
    )
  }

  const serverError = start.isError ? replayErrorMessage(start.error) : null

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <LabeledField label="Symbol" htmlFor="replay-symbol" error={errors.symbol}>
          <input
            id="replay-symbol"
            className={wellInputClass}
            value={values.symbol}
            onChange={update('symbol')}
            placeholder="WIN$N"
            autoComplete="off"
            spellCheck={false}
          />
        </LabeledField>
        <LabeledField label="First day" htmlFor="replay-first-day" error={errors.startDay}>
          <input
            id="replay-first-day"
            type="date"
            className={wellInputClass}
            value={values.startDay}
            onChange={update('startDay')}
          />
        </LabeledField>
        <LabeledField label="Last day" htmlFor="replay-last-day" error={errors.endDay}>
          <input
            id="replay-last-day"
            type="date"
            className={wellInputClass}
            value={values.endDay}
            onChange={update('endDay')}
          />
        </LabeledField>
        <LabeledField
          label="Initial capital (BRL)"
          htmlFor="replay-capital"
          error={errors.initialCapital}
        >
          <input
            id="replay-capital"
            inputMode="decimal"
            className={wellInputClass}
            value={values.initialCapital}
            onChange={update('initialCapital')}
          />
        </LabeledField>
        <LabeledField
          label="Point value (R$ per point)"
          htmlFor="replay-point-value"
          error={errors.pointValue}
        >
          <input
            id="replay-point-value"
            inputMode="decimal"
            className={wellInputClass}
            value={values.pointValue}
            onChange={update('pointValue')}
            placeholder="0.20"
          />
        </LabeledField>
        <LabeledField
          label="Price tick (smallest price step)"
          htmlFor="replay-price-tick"
          error={errors.priceTick}
        >
          <input
            id="replay-price-tick"
            inputMode="decimal"
            className={wellInputClass}
            value={values.priceTick}
            onChange={update('priceTick')}
            placeholder="5"
          />
        </LabeledField>
      </div>

      <p className="text-silver-400 text-xs">
        The replay covers whole days in exchange time. It starts paused: deploy strategies in
        q_terminal before you resume.
      </p>

      {phase ? <p className="text-silver-300 text-sm">{PHASE_TEXT[phase]}</p> : null}
      {serverError ? (
        <p role="alert" className="text-sm text-rose-300">
          {serverError}
        </p>
      ) : null}

      <div>
        <Button type="submit" variant="brass" disabled={start.isPending}>
          {start.isPending ? 'Starting…' : 'Start replay'}
        </Button>
      </div>
    </form>
  )
}
