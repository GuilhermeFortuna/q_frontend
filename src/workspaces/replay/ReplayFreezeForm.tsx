import { useState, type FormEvent } from 'react'

import { replayErrorMessage, useFreezeDataset } from '@/api/queries/replay'
import { Button } from '@/components/ui/button'
import { LabeledField } from '@/components/ui/LabeledField'
import { wellInputClass } from '@/components/ui/wellInputStyles'
import {
  buildFreezeRequest,
  type FormErrors,
  type FreezeForm as FreezeFormValues,
} from '@/workspaces/replay/replayControls'

const EMPTY: FreezeFormValues = {
  symbol: '',
  startDay: '',
  endDay: '',
  point: '',
  digits: '0',
  volumeMin: '1',
  volumeStep: '1',
  volumeMax: '100',
  contractSize: '1',
  marginPerContract: '',
  commissionPerContract: '0',
  description: '',
}

type ReplayFreezeFormProps = {
  symbols: string[]
}

export function ReplayFreezeForm({ symbols }: ReplayFreezeFormProps) {
  const [values, setValues] = useState<FreezeFormValues>(EMPTY)
  const [errors, setErrors] = useState<FormErrors<keyof FreezeFormValues>>({})
  const freeze = useFreezeDataset()

  const update = (field: keyof FreezeFormValues) => (event: { target: { value: string } }) =>
    setValues((previous) => ({ ...previous, [field]: event.target.value }))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const { body, errors: problems } = buildFreezeRequest(values)
    setErrors(problems)
    if (!body) return
    freeze.mutate(body)
  }

  const serverError = freeze.isError ? replayErrorMessage(freeze.error) : null

  return (
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={submit} noValidate>
      <LabeledField label="TickStore symbol" htmlFor="replay-freeze-symbol" error={errors.symbol}>
        <input
          id="replay-freeze-symbol"
          className={wellInputClass}
          list="replay-freeze-symbols"
          value={values.symbol}
          onChange={update('symbol')}
          placeholder="WIN$N"
          aria-invalid={errors.symbol ? true : undefined}
        />
        <datalist id="replay-freeze-symbols">
          {symbols.map((symbol) => (
            <option key={symbol} value={symbol} />
          ))}
        </datalist>
      </LabeledField>
      <LabeledField label="First session day" htmlFor="replay-freeze-start" error={errors.startDay}>
        <input
          id="replay-freeze-start"
          type="date"
          className={wellInputClass}
          value={values.startDay}
          onChange={update('startDay')}
        />
      </LabeledField>
      <LabeledField label="Last session day" htmlFor="replay-freeze-end" error={errors.endDay}>
        <input
          id="replay-freeze-end"
          type="date"
          className={wellInputClass}
          value={values.endDay}
          onChange={update('endDay')}
        />
      </LabeledField>
      <LabeledField label="Point (price step)" htmlFor="replay-freeze-point" error={errors.point}>
        <input
          id="replay-freeze-point"
          inputMode="decimal"
          className={wellInputClass}
          value={values.point}
          onChange={update('point')}
        />
      </LabeledField>
      <LabeledField label="Digits" htmlFor="replay-freeze-digits" error={errors.digits}>
        <input
          id="replay-freeze-digits"
          inputMode="numeric"
          className={wellInputClass}
          value={values.digits}
          onChange={update('digits')}
        />
      </LabeledField>
      <LabeledField
        label="Margin per contract"
        htmlFor="replay-freeze-margin"
        error={errors.marginPerContract}
      >
        <input
          id="replay-freeze-margin"
          inputMode="decimal"
          className={wellInputClass}
          value={values.marginPerContract}
          onChange={update('marginPerContract')}
        />
      </LabeledField>
      <LabeledField label="Minimum volume" htmlFor="replay-freeze-vmin" error={errors.volumeMin}>
        <input
          id="replay-freeze-vmin"
          inputMode="decimal"
          className={wellInputClass}
          value={values.volumeMin}
          onChange={update('volumeMin')}
        />
      </LabeledField>
      <LabeledField label="Volume step" htmlFor="replay-freeze-vstep" error={errors.volumeStep}>
        <input
          id="replay-freeze-vstep"
          inputMode="decimal"
          className={wellInputClass}
          value={values.volumeStep}
          onChange={update('volumeStep')}
        />
      </LabeledField>
      <LabeledField label="Maximum volume" htmlFor="replay-freeze-vmax" error={errors.volumeMax}>
        <input
          id="replay-freeze-vmax"
          inputMode="decimal"
          className={wellInputClass}
          value={values.volumeMax}
          onChange={update('volumeMax')}
        />
      </LabeledField>
      <LabeledField label="Contract size" htmlFor="replay-freeze-size" error={errors.contractSize}>
        <input
          id="replay-freeze-size"
          inputMode="decimal"
          className={wellInputClass}
          value={values.contractSize}
          onChange={update('contractSize')}
        />
      </LabeledField>
      <LabeledField
        label="Commission per contract"
        htmlFor="replay-freeze-commission"
        error={errors.commissionPerContract}
      >
        <input
          id="replay-freeze-commission"
          inputMode="decimal"
          className={wellInputClass}
          value={values.commissionPerContract}
          onChange={update('commissionPerContract')}
        />
      </LabeledField>
      <div className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-3">
        <p className="text-silver-400 text-xs">
          The instrument specification is recorded in the dataset manifest. The TickStore is read
          only.
        </p>
        {serverError ? (
          <p role="alert" className="text-sm text-rose-300">
            {serverError}
          </p>
        ) : null}
        <div>
          <Button type="submit" variant="brass" disabled={freeze.isPending}>
            {freeze.isPending ? 'Freezing…' : 'Freeze dataset'}
          </Button>
        </div>
      </div>
    </form>
  )
}
