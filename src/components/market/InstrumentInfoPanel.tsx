import { isAxiosError } from 'axios'

import { useInstrumentInfo } from '@/api/queries/market-data'

import { formatSpecNumber } from './instrumentInfoUtils'

type InstrumentInfoPanelProps = {
  symbol: string
  enabled: boolean
}

type InfoRow = {
  label: string
  value: string
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="bg-carbon-800 h-4 animate-pulse rounded" />
      ))}
    </div>
  )
}

function InfoDefinitionList({ rows }: { rows: InfoRow[] }) {
  return (
    <dl className="flex flex-col gap-2.5 overflow-y-auto p-4">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-3">
          <dt className="text-silver-500 shrink-0 font-mono text-[10px] tracking-wider uppercase">
            {row.label}
          </dt>
          <dd className="text-silver-200 text-right font-mono text-xs">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function InstrumentInfoPanel({ symbol, enabled }: InstrumentInfoPanelProps) {
  const infoQuery = useInstrumentInfo(symbol, { enabled })

  if (infoQuery.isLoading) {
    return <SkeletonRows />
  }

  const isNotFound =
    infoQuery.isError && isAxiosError(infoQuery.error) && infoQuery.error.response?.status === 404

  if (isNotFound || !infoQuery.data) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-silver-500 font-mono text-xs">No instrument info available.</p>
      </div>
    )
  }

  const info = infoQuery.data
  const rows: InfoRow[] = [
    { label: 'Description', value: info.description },
    { label: 'Exchange', value: info.exchange },
    {
      label: 'Currency',
      value: `${info.currencyBase} / ${info.currencyProfit}`,
    },
    { label: 'Digits', value: String(info.digits) },
    { label: 'Point', value: formatSpecNumber(info.point) },
    { label: 'Tick Size', value: formatSpecNumber(info.tickSize) },
    { label: 'Tick Value', value: formatSpecNumber(info.tickValue) },
    { label: 'Contract Size', value: formatSpecNumber(info.contractSize) },
    { label: 'Volume Min', value: formatSpecNumber(info.volumeMin) },
    { label: 'Volume Max', value: formatSpecNumber(info.volumeMax) },
    { label: 'Volume Step', value: formatSpecNumber(info.volumeStep) },
    {
      label: 'Spread Type',
      value: info.spreadFloating ? 'Floating' : 'Fixed',
    },
  ]

  return <InfoDefinitionList rows={rows} />
}
