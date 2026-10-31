import { useState, type FormEvent } from 'react'

import { replayErrorMessage, useStartReplayRun } from '@/api/queries/replay'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/Callout'
import { LabeledField } from '@/components/ui/LabeledField'
import { wellInputClass } from '@/components/ui/wellInputStyles'
import {
  buildStartRequest,
  EXCHANGE_TIMEZONE,
  SPEED_MAX,
  SPEED_MIN,
  type FormErrors,
  type RunForm as RunFormValues,
} from '@/workspaces/replay/replayControls'

const EMPTY: RunFormValues = {
  datasetId: '',
  startLocal: '',
  endLocal: '',
  warmupLocal: '',
  initialBalance: '100000.00',
  login: '',
  currency: 'BRL',
  marketDataMs: '0',
  orderTransportMs: '0',
  brokerAcceptMs: '0',
  brokerExecutionMs: '0',
  brokerResponseMs: '0',
  rate: '1',
}

type ReplayRunFormProps = {
  datasetId: string
}

export function ReplayRunForm({ datasetId }: ReplayRunFormProps) {
  const [values, setValues] = useState<RunFormValues>(EMPTY)
  const [errors, setErrors] = useState<FormErrors<keyof RunFormValues>>({})
  const start = useStartReplayRun()

  const update = (field: keyof RunFormValues) => (event: { target: { value: string } }) =>
    setValues((previous) => ({ ...previous, [field]: event.target.value }))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const { body, errors: problems } = buildStartRequest({ ...values, datasetId })
    setErrors(problems)
    if (!body) return
    start.mutate(body)
  }

  const latencyField = (
    field:
      | 'marketDataMs'
      | 'orderTransportMs'
      | 'brokerAcceptMs'
      | 'brokerExecutionMs'
      | 'brokerResponseMs',
    label: string,
    id: string,
  ) => (
    <LabeledField
      label={label}
      htmlFor={id}
      error={field === 'marketDataMs' ? errors.marketDataMs : undefined}
    >
      <input
        id={id}
        inputMode="numeric"
        className={wellInputClass}
        value={values[field]}
        onChange={update(field)}
      />
    </LabeledField>
  )

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <p className="text-silver-300 text-sm">
        Times are {EXCHANGE_TIMEZONE} wall time (BRT), typed as YYYY-MM-DD HH:mm. The run starts
        paused: deploy strategies in q_terminal before you resume.
      </p>
      {errors.datasetId ? (
        <Callout type="warning" title="No dataset selected">
          {errors.datasetId}
        </Callout>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <LabeledField
          label="Start (inclusive)"
          htmlFor="replay-run-start"
          error={errors.startLocal}
        >
          <input
            id="replay-run-start"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="2026-10-01 09:00"
            className={wellInputClass}
            value={values.startLocal}
            onChange={update('startLocal')}
          />
        </LabeledField>
        <LabeledField label="End (exclusive)" htmlFor="replay-run-end" error={errors.endLocal}>
          <input
            id="replay-run-end"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="2026-10-01 09:00"
            className={wellInputClass}
            value={values.endLocal}
            onChange={update('endLocal')}
          />
        </LabeledField>
        <LabeledField
          label="Warmup start (optional)"
          htmlFor="replay-run-warmup"
          error={errors.warmupLocal}
        >
          <input
            id="replay-run-warmup"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="2026-10-01 09:00"
            className={wellInputClass}
            value={values.warmupLocal}
            onChange={update('warmupLocal')}
          />
        </LabeledField>
        <LabeledField
          label="Initial balance"
          htmlFor="replay-run-balance"
          error={errors.initialBalance}
        >
          <input
            id="replay-run-balance"
            inputMode="decimal"
            className={wellInputClass}
            value={values.initialBalance}
            onChange={update('initialBalance')}
          />
        </LabeledField>
        <LabeledField label="Demo account login" htmlFor="replay-run-login" error={errors.login}>
          <input
            id="replay-run-login"
            inputMode="numeric"
            className={wellInputClass}
            value={values.login}
            onChange={update('login')}
          />
        </LabeledField>
        <LabeledField
          label="Account currency"
          htmlFor="replay-run-currency"
          error={errors.currency}
        >
          <input
            id="replay-run-currency"
            className={wellInputClass}
            value={values.currency}
            onChange={update('currency')}
          />
        </LabeledField>
        <LabeledField
          label={`Initial speed (${SPEED_MIN}–${SPEED_MAX}×)`}
          htmlFor="replay-run-rate"
          error={errors.rate}
        >
          <input
            id="replay-run-rate"
            inputMode="decimal"
            className={wellInputClass}
            value={values.rate}
            onChange={update('rate')}
          />
        </LabeledField>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-silver-300 mb-2 text-xs font-medium">
          Modeled latency, market milliseconds (fixed for the run)
        </legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {latencyField('marketDataMs', 'Market data', 'replay-run-lat-md')}
          {latencyField('orderTransportMs', 'Order transport', 'replay-run-lat-ot')}
          {latencyField('brokerAcceptMs', 'Broker accept', 'replay-run-lat-ba')}
          {latencyField('brokerExecutionMs', 'Broker execution', 'replay-run-lat-be')}
          {latencyField('brokerResponseMs', 'Broker response', 'replay-run-lat-br')}
        </div>
      </fieldset>

      {start.isError ? (
        <p role="alert" className="text-sm text-rose-300">
          {replayErrorMessage(start.error)}
        </p>
      ) : null}

      <div>
        <Button type="submit" variant="brass" disabled={start.isPending}>
          {start.isPending ? 'Starting…' : 'Start replay stack'}
        </Button>
      </div>
    </form>
  )
}
