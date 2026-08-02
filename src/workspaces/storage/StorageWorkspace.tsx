import { endOfDay, formatISO, startOfDay, subMonths } from 'date-fns'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import axios from 'axios'
import { useQueries } from '@tanstack/react-query'

import { useDataSource } from '@/api/queries/system'
import {
  useIngestStatus,
  useStartIngest,
  useDeleteStorage,
  useStorageInventory,
} from '@/api/queries/storage'
import {
  fetchOhlcvAvailableRange,
  marketDataKeys,
  useSearchSymbols,
} from '@/api/queries/market-data'
import { inputClass } from '@/components/shared/InstrumentConfigFields'
import { Button } from '@/components/ui/button'
import { chipClass } from '@/components/ui/chipStyles'
import { LabeledField } from '@/components/ui/LabeledField'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { GlowCard } from '@/components/ui/spotlight-card'
import { Callout } from '@/components/ui/Callout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui'
import { Database, Download, Trash2, Calendar, AlertTriangle, Info } from 'lucide-react'

import { formatBytes } from '@/lib/formatBytes'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { combineOhlcvAvailableRanges, toStorageDateInputs } from '@/lib/backtesting/dateRange'
import { cn } from '@/lib/utils'
import type { Instrument } from '@/types/api'
import {
  inventoryItemKey,
  isIngestTerminalStatus,
  resolveInventoryKind,
  STORAGE_TIMEFRAME_OPTIONS,
  type IngestKind,
  type StorageKind,
} from '@/types/storage'

const SYMBOL_SUGGESTION_LIMIT = 6

const symbolSuggestionItemClass =
  'w-full px-3 py-2 text-left transition-all duration-150'

function KindBadge({ kind }: { kind: StorageKind }) {
  const isTicks = kind === 'ticks'
  return (
    <span
      className={cn(
        'text-2xs rounded-full px-2 py-0.5 font-semibold tracking-wide uppercase',
        isTicks ? 'bg-violet-500/10 text-violet-300' : 'bg-brass-500/10 text-brass-300',
      )}
    >
      {isTicks ? 'Ticks' : 'Bars'}
    </span>
  )
}

export function StorageWorkspace() {
  const { data: inventory, isLoading: inventoryLoading } = useStorageInventory()
  const { data: dataSource } = useDataSource()
  const startIngest = useStartIngest()
  const deleteStorage = useDeleteStorage()

  const [symbol, setSymbol] = useState('PETR4')
  const [symbolQuery, setSymbolQuery] = useState('')
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(['D1'])
  const [startDate, setStartDate] = useState(() =>
    formatISO(subMonths(new Date(), 6), { representation: 'date' }),
  )
  const [endDate, setEndDate] = useState(() => formatISO(new Date(), { representation: 'date' }))
  const [dataKind, setDataKind] = useState<IngestKind>('bars')
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [useFullRangeActive, setUseFullRangeActive] = useState(false)

  const trimmedSymbol = symbol.trim().toUpperCase()

  const searchQuery = symbolQuery.trim().length >= 1 ? symbolQuery : symbol
  const symbolSearch = useSearchSymbols(searchQuery)
  const suggestions = useMemo(() => symbolSearch.data ?? [], [symbolSearch.data])
  const visibleSuggestions = useMemo(
    () => suggestions.slice(0, SYMBOL_SUGGESTION_LIMIT),
    [suggestions],
  )
  const suggestionsOpen = showSuggestions && visibleSuggestions.length > 0

  useEffect(() => {
    setSelectedSuggestionIndex(0)
  }, [visibleSuggestions])

  const ingestStatus = useIngestStatus(activeJobId)
  const ingestJob = ingestStatus.data
  const mt5Available = dataSource?.mt5_available ?? false
  const isTicksKind = dataKind === 'ticks'
  const canProbeAvailableRange =
    mt5Available && !isTicksKind && trimmedSymbol.length > 0 && selectedTimeframes.length > 0

  const availableRangeQueries = useQueries({
    queries: canProbeAvailableRange
      ? selectedTimeframes.map((timeframe) => ({
          queryKey: marketDataKeys.availableRange(trimmedSymbol, timeframe),
          queryFn: () => fetchOhlcvAvailableRange(trimmedSymbol, timeframe),
          staleTime: 60_000,
        }))
      : [],
  })

  const availableRanges = useMemo(
    () =>
      availableRangeQueries
        .map((query) => query.data)
        .filter((range): range is NonNullable<typeof range> => range != null),
    [availableRangeQueries],
  )

  const combinedAvailableRange = useMemo(
    () => combineOhlcvAvailableRanges(availableRanges),
    [availableRanges],
  )

  const availableRangeLoading =
    canProbeAvailableRange && availableRangeQueries.some((query) => query.isLoading)
  const availableRangeError = availableRangeQueries.find((query) => query.isError)?.error
  const availableRangeErrorMessage = availableRangeError
    ? axios.isAxiosError(availableRangeError)
      ? ((availableRangeError.response?.data as { detail?: string })?.detail ??
        availableRangeError.message)
      : 'Failed to load available data range'
    : null
  const allRangesLoaded =
    canProbeAvailableRange &&
    availableRangeQueries.length > 0 &&
    availableRangeQueries.every((query) => query.isSuccess || query.isError) &&
    availableRanges.length === selectedTimeframes.length
  const someRangesMissing =
    canProbeAvailableRange &&
    availableRangeQueries.every((query) => !query.isLoading) &&
    availableRanges.length > 0 &&
    availableRanges.length < selectedTimeframes.length

  const applyFullAvailableRange = () => {
    if (!combinedAvailableRange) return
    const { start, end } = toStorageDateInputs(
      combinedAvailableRange.start,
      combinedAvailableRange.end,
    )
    setStartDate(start)
    setEndDate(end)
    setUseFullRangeActive(true)
  }
  const downloadDisabled =
    !mt5Available ||
    startIngest.isPending ||
    (!!activeJobId && !isIngestTerminalStatus(ingestJob?.status))
  const canDownload = symbol.trim().length > 0 && (isTicksKind || selectedTimeframes.length > 0)

  useEffect(() => {
    if (ingestJob && isIngestTerminalStatus(ingestJob.status)) {
      const timer = window.setTimeout(() => setActiveJobId(null), 4000)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [ingestJob])

  const toggleTimeframe = (tf: string) => {
    setSelectedTimeframes((current) =>
      current.includes(tf) ? current.filter((item) => item !== tf) : [...current, tf],
    )
  }

  const selectSuggestion = (item: Instrument) => {
    setSymbol(item.symbol)
    setSymbolQuery(item.symbol)
    setShowSuggestions(false)
    setSelectedSuggestionIndex(0)
  }

  const handleSymbolKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!suggestionsOpen) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedSuggestionIndex((current) => Math.min(current + 1, visibleSuggestions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedSuggestionIndex((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter') {
      const selected = visibleSuggestions[selectedSuggestionIndex]
      if (selected) {
        event.preventDefault()
        selectSuggestion(selected)
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setShowSuggestions(false)
    }
  }

  const handleDownload = () => {
    if (!canDownload) return
    const start = startOfDay(new Date(startDate))
    const end = endOfDay(new Date(endDate))
    startIngest.mutate(
      {
        symbol: symbol.trim().toUpperCase(),
        timeframes: isTicksKind ? [] : selectedTimeframes,
        start: start.toISOString(),
        end: end.toISOString(),
        kind: dataKind,
      },
      {
        onSuccess: (response) => {
          setActiveJobId(response.job_id)
        },
      },
    )
  }

  const startError = startIngest.error
    ? axios.isAxiosError(startIngest.error)
      ? ((startIngest.error.response?.data as { detail?: string })?.detail ??
        startIngest.error.message)
      : 'Failed to start ingest job'
    : null

  return (
    <div className="animate-fade-in-up mx-auto flex max-w-5xl flex-col gap-6 pb-28">
      <div className="flex items-center gap-3">
        <div className="border-carbon-700/60 bg-carbon-900/50 text-silver-300 flex h-10 w-10 items-center justify-center rounded-lg border">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-silver-100 tracking-display text-xl font-semibold">
            Storage
          </h1>
          <p className="text-silver-400 mt-0.5 text-sm">
            Download OHLCV bars or tick data from MetaTrader 5 into the local parquet store, then
            serve them in Local data-source mode on Linux.
          </p>
        </div>
      </div>

      <Panel living className="p-0">
        <PanelHeader title="Download from MT5" />
        <div className="space-y-5 px-4 pb-4">
          <p className="text-silver-400 -mt-1 text-xs">
            Fills the portable store under{' '}
            <span className="text-silver-200 font-mono">{inventory?.root ?? 'data/market'}</span>
          </p>
          {!mt5Available ? (
            <Callout type="warning" title="MetaTrader 5 Offline">
              Downloading needs MT5 — run this on the Windows machine with MetaTrader connected.
            </Callout>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <LabeledField label="Symbol" htmlFor="storage-symbol">
              <div className="relative">
                <input
                  id="storage-symbol"
                  type="text"
                  value={symbol}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={suggestionsOpen}
                  aria-controls="storage-symbol-suggestions"
                  aria-activedescendant={
                    suggestionsOpen
                      ? `storage-symbol-option-${visibleSuggestions[selectedSuggestionIndex]?.symbol ?? selectedSuggestionIndex}`
                      : undefined
                  }
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase()
                    setSymbol(value)
                    setSymbolQuery(value)
                    setShowSuggestions(true)
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setShowSuggestions(false)}
                  onKeyDown={handleSymbolKeyDown}
                  className={inputClass}
                  placeholder="e.g. PETR4"
                  autoComplete="off"
                />
                {suggestionsOpen ? (
                  <ul
                    id="storage-symbol-suggestions"
                    role="listbox"
                    className="border-carbon-700/60 bg-carbon-950 absolute right-0 left-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border p-1 text-xs shadow-xl"
                  >
                    {visibleSuggestions.map((item, index) => {
                      const isActive = index === selectedSuggestionIndex
                      return (
                        <li
                          key={item.symbol}
                          id={`storage-symbol-option-${item.symbol}`}
                          role="option"
                          aria-selected={isActive}
                        >
                          <GlowCard intensity="tile" className="w-full rounded-md">
                            <button
                              type="button"
                              className={cn(
                                symbolSuggestionItemClass,
                                isActive
                                  ? chipClass(true)
                                  : chipClass(false, 'text-silver-200 border-transparent'),
                              )}
                              // Keep the input focused so onBlur doesn't close the list
                              // before this click registers.
                              onMouseDown={(e) => e.preventDefault()}
                              onMouseEnter={() => setSelectedSuggestionIndex(index)}
                              onClick={() => selectSuggestion(item)}
                            >
                              <span className="text-brass-400 font-mono font-semibold">
                                {item.symbol}
                              </span>
                              <span
                                className={cn(
                                  'ml-2',
                                  isActive ? 'text-brass-200/80' : 'text-silver-500',
                                )}
                              >
                                {item.name}
                              </span>
                            </button>
                          </GlowCard>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
            </LabeledField>

            <LabeledField label="Data kind">
              <SegmentedToggle
                aria-label="Data kind"
                value={dataKind}
                onChange={setDataKind}
                options={[
                  { value: 'bars', label: 'Bars' },
                  { value: 'ticks', label: 'Ticks' },
                ]}
              />
            </LabeledField>
          </div>

          {isTicksKind ? (
            <Callout type="info" title="Tick Ingestion Notice">
              Tick ranges are very large and ingest slowly (progress advances per month). Start with
              a narrow date range — a few days or one week — before pulling longer history.
            </Callout>
          ) : (
            <LabeledField label="Timeframes">
              <SegmentedToggle
                aria-label="Timeframes"
                mode="multi"
                values={selectedTimeframes}
                onToggle={toggleTimeframe}
                options={STORAGE_TIMEFRAME_OPTIONS.map((tf) => ({ value: tf, label: tf }))}
              />
            </LabeledField>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledField label="Start" htmlFor="storage-start">
              <input
                id="storage-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setUseFullRangeActive(false)
                }}
                className={inputClass}
              />
            </LabeledField>
            <LabeledField label="End" htmlFor="storage-end">
              <input
                id="storage-end"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setUseFullRangeActive(false)
                }}
                className={inputClass}
              />
            </LabeledField>
          </div>

          {canProbeAvailableRange ? (
            <Panel className="border-brass-600/15 bg-carbon-900/10 p-4">
              {availableRangeLoading ? (
                <div className="text-silver-400 flex items-center gap-2.5 text-sm">
                  <div className="border-brass-500 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                  <span>Checking MT5 history…</span>
                </div>
              ) : availableRangeErrorMessage ? (
                <div className="flex items-center gap-2 text-sm text-rose-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{availableRangeErrorMessage}</span>
                </div>
              ) : allRangesLoaded && combinedAvailableRange ? (
                <div className="space-y-3.5">
                  <div className="flex items-start gap-3">
                    <Calendar className="text-brass-400 mt-0.5 h-4.5 w-4.5 shrink-0" />
                    <div className="space-y-1">
                      {availableRanges.length === 1 ? (
                        <p className="text-silver-300 text-sm">
                          Available in MT5 for{' '}
                          <span className="text-brass-400 font-mono font-semibold">
                            {trimmedSymbol}
                          </span>{' '}
                          <span className="text-brass-400 font-mono font-semibold">
                            {availableRanges[0].timeframe}
                          </span>
                          :{' '}
                          <span className="text-silver-100 font-semibold">
                            {formatDisplayDateTime(availableRanges[0].start)}
                          </span>{' '}
                          →{' '}
                          <span className="text-silver-100 font-semibold">
                            {formatDisplayDateTime(availableRanges[0].end)}
                          </span>
                          <span className="text-silver-500 font-mono text-xs">
                            {' '}
                            ({availableRanges[0].bar_count.toLocaleString()} bars)
                          </span>
                        </p>
                      ) : (
                        <>
                          <p className="text-silver-300 text-sm">
                            Combined range across{' '}
                            <span className="text-silver-100 font-semibold">
                              {selectedTimeframes.length}
                            </span>{' '}
                            timeframes:{' '}
                            <span className="text-silver-100 font-semibold">
                              {formatDisplayDateTime(combinedAvailableRange.start)}
                            </span>{' '}
                            →{' '}
                            <span className="text-silver-100 font-semibold">
                              {formatDisplayDateTime(combinedAvailableRange.end)}
                            </span>
                          </p>
                          <ul className="text-silver-500 space-y-1 font-mono text-xs">
                            {availableRanges.map((range) => (
                              <li key={range.timeframe} className="flex items-center gap-2">
                                <span className="text-silver-400 w-8 font-[560]">
                                  {range.timeframe}:
                                </span>
                                <span>
                                  {formatDisplayDateTime(range.start)} →{' '}
                                  {formatDisplayDateTime(range.end)}
                                </span>
                                <span className="text-silver-600">
                                  ({range.bar_count.toLocaleString()} bars)
                                </span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    title="Set start and end to the full range available in MetaTrader 5"
                    onClick={applyFullAvailableRange}
                    className={cn(chipClass(useFullRangeActive), 'flex items-center gap-1.5')}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Use full range
                  </button>
                </div>
              ) : someRangesMissing ? (
                <div className="text-silver-400 flex items-center gap-2 text-sm">
                  <Info className="text-brass-400 h-4 w-4 shrink-0" />
                  <span>No MT5 history found for one or more selected timeframes.</span>
                </div>
              ) : (
                <div className="text-silver-400 flex items-center gap-2 text-sm">
                  <Info className="text-brass-400 h-4 w-4 shrink-0" />
                  <span>No MT5 history found for this symbol and timeframe selection.</span>
                </div>
              )}
            </Panel>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="brass"
              onClick={handleDownload}
              disabled={downloadDisabled || !canDownload}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {startIngest.isPending ? 'Starting…' : 'Download'}
            </Button>
            {startError ? <p className="text-sm text-rose-300">{startError}</p> : null}
          </div>

          {ingestJob && activeJobId ? (
            <Panel className="quant-panel--active-run space-y-2 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-silver-200 flex items-center gap-2 capitalize">
                  <span
                    className="live-status-dot h-1.5 w-1.5 rounded-full bg-emerald-400"
                    aria-hidden
                  />
                  {ingestJob.status}
                </span>
                <span className="text-brass-400 font-mono tabular-nums">
                  {Math.round((ingestJob.progress ?? 0) * 100)}%
                </span>
              </div>
              <div className="surface-well h-2 overflow-hidden rounded-full">
                <div
                  className="from-brass-600 to-brass-400 h-full rounded-full bg-gradient-to-r transition-all"
                  style={{ width: `${Math.round((ingestJob.progress ?? 0) * 100)}%` }}
                />
              </div>
              <p className="text-silver-400 text-sm">{ingestJob.detail}</p>
              {ingestJob.results?.map((row) => (
                <p key={row.timeframe} className="text-silver-500 font-mono text-xs">
                  {row.timeframe}: {row.status}
                  {row.rows != null ? ` · ${row.rows} rows` : ''}
                  {row.error ? ` · ${row.error}` : ''}
                </p>
              ))}
              {ingestJob.error ? <p className="text-sm text-rose-300">{ingestJob.error}</p> : null}
            </Panel>
          ) : null}
        </div>
      </Panel>

      <Panel living className="p-0">
        <PanelHeader title="Inventory" />
        <div className="px-4 pb-4">
          <p className="text-silver-400 -mt-1 mb-4 text-xs">
            Stored bars and ticks in the local parquet catalog
          </p>
          {inventoryLoading ? (
            <p className="text-silver-400 text-sm">Loading inventory…</p>
          ) : !inventory?.items.length ? (
            <p className="text-silver-400 text-sm">
              The store is empty. On Windows with MT5 connected, use Download above to ingest bars
              or ticks for a symbol.
            </p>
          ) : (
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Timeframe</TableHead>
                  <TableHead>Range</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.items.map((item) => {
                  const kind = resolveInventoryKind(item)
                  const isTicks = kind === 'ticks'
                  const isDeletingThisItem =
                    deleteStorage.isPending &&
                    deleteStorage.variables?.symbol === item.symbol &&
                    deleteStorage.variables?.kind === kind &&
                    deleteStorage.variables?.timeframe === item.timeframe

                  return (
                    <TableRow key={inventoryItemKey(item)}>
                      <TableCell className="text-silver-100 font-mono font-semibold">
                        {item.symbol}
                      </TableCell>
                      <TableCell>
                        <KindBadge kind={kind} />
                      </TableCell>
                      <TableCell className="text-silver-200 font-mono font-medium">
                        {isTicks ? '—' : (item.timeframe ?? '—')}
                      </TableCell>
                      <TableCell className="text-silver-300 font-mono text-xs">
                        {formatDisplayDateTime(item.start)} → {formatDisplayDateTime(item.end)}
                      </TableCell>
                      <TableCell className="text-silver-200 font-mono tabular-nums">
                        {item.rows.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-silver-300">{formatBytes(item.bytes)}</TableCell>
                      <TableCell className="text-silver-400 text-xs">
                        {formatDisplayDateTime(item.updated_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold text-rose-400 transition-all duration-150 hover:bg-rose-500/10 hover:text-rose-300 active:scale-95"
                          disabled={deleteStorage.isPending}
                          onClick={() => {
                            const label = isTicks
                              ? `Delete stored ${item.symbol} tick data?`
                              : `Delete stored ${item.symbol} ${item.timeframe} bar data?`
                            if (window.confirm(label)) {
                              deleteStorage.mutate({
                                symbol: item.symbol,
                                kind,
                                timeframe: item.timeframe,
                              })
                            }
                          }}
                        >
                          {isDeletingThisItem ? (
                            <>
                              <span className="h-3 w-3 animate-spin rounded-full border border-rose-400 border-t-transparent" />
                              Deleting…
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </>
                          )}
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </Panel>
    </div>
  )
}
