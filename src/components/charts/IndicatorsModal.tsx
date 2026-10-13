import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  X,
  Search,
  Sliders,
  Check,
  RotateCcw,
  BookOpen,
  Settings2,
  ChevronRight,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader } from '@/components/ui/Dialog'
import { NumberInput } from '@/components/ui/number-input'
import { LabeledField } from '@/components/ui/LabeledField'
import { Button } from '@/components/ui/button'
import { indicatorRequestErrorMessage, useIndicatorCatalog } from '@/api/queries/marketIndicators'
import { defaultParametersForEntry, type IndicatorConfig } from '@/lib/market/indicatorConfig'
import {
  indicatorChoiceLabels,
  indicatorDocumentation,
  indicatorParameterErrors,
  parameterHelp,
} from '@/lib/market/indicatorDocumentation'
import { IndicatorGuide } from './IndicatorGuide'
import { IndicatorPreview, type IndicatorPreviewContext } from './IndicatorPreview'
import type { IndicatorCatalogEntry, IndicatorParameterSpec } from '../../../contracts/api'

export type IndicatorsModalProps = {
  isOpen: boolean
  onClose: () => void
  indicators: IndicatorConfig[]
  onChange: (indicators: IndicatorConfig[]) => void
  previewContext?: IndicatorPreviewContext
  /** Restore the toolbar control when the conditionally mounted modal closes. */
  triggerRef?: React.RefObject<HTMLButtonElement | null>
}

const PRESET_COLORS = [
  { value: '#c9a227', name: 'Brass' },
  { value: '#6eb5ff', name: 'Blue' },
  { value: '#a78bfa', name: 'Violet' },
  { value: '#f97316', name: 'Orange' },
  { value: '#26a69a', name: 'Teal' },
  { value: '#ef5350', name: 'Red' },
]
const CONTROL_CLASS =
  'surface-well text-silver-100 focus-visible:outline-brass-400 w-full rounded-md border border-carbon-700 px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2'

function ParameterControl({
  spec,
  value,
  onChange,
  id,
  error,
}: {
  spec: IndicatorParameterSpec
  value: number | string | undefined
  onChange: (next: number | string) => void
  id: string
  error?: string
}) {
  const a11y = {
    id,
    'aria-invalid': !!error,
    'aria-describedby': `${id}-help${error ? ` ${id}-error` : ''}`,
  }
  if (spec.choices?.length)
    return (
      <select
        {...a11y}
        value={String(value ?? spec.default ?? spec.choices[0])}
        onChange={(e) => onChange(e.target.value)}
        className={CONTROL_CLASS}
      >
        {spec.choices.map((choice) => (
          <option key={choice} value={choice}>
            {indicatorChoiceLabels[choice] ?? choice}
          </option>
        ))}
      </select>
    )
  if (spec.type === 'float' || spec.type === 'int')
    return (
      <NumberInput
        {...a11y}
        value={typeof value === 'number' ? value : Number(spec.default ?? 0)}
        onChange={onChange}
        min={spec.minimum ?? undefined}
        max={spec.maximum ?? undefined}
        step={spec.type === 'int' ? 1 : 'any'}
        className={`${CONTROL_CLASS} font-mono`}
      />
    )
  return (
    <input
      {...a11y}
      value={String(value ?? spec.default ?? '')}
      onChange={(e) => onChange(e.target.value)}
      className={CONTROL_CLASS}
    />
  )
}

function initialDrafts(indicators: IndicatorConfig[]) {
  const drafts = new Map<string, IndicatorConfig>()
  for (const indicator of indicators)
    if (!drafts.has(indicator.id)) drafts.set(indicator.id, indicator)
  return drafts
}

function IndicatorsModalBody({
  onClose,
  indicators,
  onChange,
  previewContext,
  triggerRef,
}: Omit<IndicatorsModalProps, 'isOpen'>) {
  const catalogQuery = useIndicatorCatalog()
  const catalog = useMemo(() => catalogQuery.data?.indicators ?? [], [catalogQuery.data])
  const [searchQuery, setSearchQuery] = useState('')
  const [enabledOnly, setEnabledOnly] = useState(false)
  const [selectedId, setSelectedId] = useState(indicators.find((item) => item.enabled)?.id ?? 'sma')
  const [draftById, setDraftById] = useState(() => initialDrafts(indicators))
  const [tab, setTab] = useState<'settings' | 'guide'>('settings')
  const searchRef = useRef<HTMLInputElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const id = useId()

  // Catalog refreshes only add new entries. Browsing never reinitializes a draft.
  useEffect(() => {
    setDraftById((previous) => {
      const missing = catalog.filter((entry) => !previous.has(entry.id))
      if (!missing.length) return previous
      const next = new Map(previous)
      for (const entry of missing)
        next.set(entry.id, {
          id: entry.id,
          enabled: false,
          parameters: defaultParametersForEntry(entry),
        })
      return next
    })
  }, [catalog])

  const activeEntry = catalog.find((entry) => entry.id === selectedId) ?? catalog[0]
  const activeDraft = activeEntry ? draftById.get(activeEntry.id) : undefined
  const activeErrors =
    activeEntry && activeDraft ? indicatorParameterErrors(activeEntry, activeDraft) : {}
  const knownIds = new Set(catalog.map((entry) => entry.id))
  const preserved = useMemo(() => {
    const ids = new Set(catalog.map((entry) => entry.id))
    return indicators.filter(
      (item, index) =>
        !ids.has(item.id) ||
        indicators.findIndex((candidate) => candidate.id === item.id) !== index,
    )
  }, [catalog, indicators])
  const additionalEnabled = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of preserved)
      if (item.enabled) counts.set(item.id, (counts.get(item.id) ?? 0) + 1)
    return counts
  }, [preserved])
  const enabledDrafts = [...draftById.values()].filter(
    (item) => item.enabled && knownIds.has(item.id),
  )
  const enabledCount = enabledDrafts.length + preserved.filter((item) => item.enabled).length
  const invalidIds = catalog
    .filter((entry) => {
      const draft = draftById.get(entry.id)
      return draft?.enabled && Object.keys(indicatorParameterErrors(entry, draft)).length > 0
    })
    .map((entry) => entry.id)

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return catalog.filter((entry) => {
      if (enabledOnly && !draftById.get(entry.id)?.enabled && !additionalEnabled.has(entry.id))
        return false
      const guide = indicatorDocumentation[entry.id]
      return (
        !query ||
        [entry.label, entry.id, entry.category, guide?.summary, ...(guide?.keywords ?? [])]
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
    })
  }, [catalog, searchQuery, enabledOnly, draftById, additionalEnabled])
  const grouped = useMemo(() => {
    const groups = new Map<string, IndicatorCatalogEntry[]>()
    for (const entry of filtered)
      groups.set(entry.category, [...(groups.get(entry.category) ?? []), entry])
    return groups
  }, [filtered])

  const updateDraft = (entryId: string, patch: Partial<IndicatorConfig>) => {
    setDraftById((previous) => {
      const current = previous.get(entryId)
      if (!current) return previous
      return new Map(previous).set(entryId, { ...current, ...patch })
    })
  }
  const handleSave = () => {
    if (catalogQuery.isPending || catalogQuery.isError || invalidIds.length) return
    // Keep configured disabled indicators, without saving every untouched default.
    const savedDrafts = catalog.flatMap((entry) => {
      const draft = draftById.get(entry.id)
      if (!draft) return []
      const defaults = defaultParametersForEntry(entry)
      const configured =
        Object.entries(draft.parameters).some(([name, value]) => defaults[name] !== value) ||
        Object.keys(defaults).some((name) => draft.parameters[name] !== defaults[name]) ||
        Object.values(draft.style ?? {}).some((value) => value !== undefined)
      return draft.enabled || configured || indicators.some((item) => item.id === entry.id)
        ? [draft]
        : []
    })
    onChange([...savedDrafts, ...preserved])
    onClose()
  }
  const switchTab = (next: 'settings' | 'guide') => setTab(next)
  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 'settings'
        : event.key === 'End'
          ? 'guide'
          : tab === 'settings'
            ? 'guide'
            : 'settings'
    switchTab(next)
    document.getElementById(`${id}-${next}-tab`)?.focus()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className="indicator-workbench [&_button:focus-visible]:outline-brass-400 [&_input[type=checkbox]:focus-visible]:outline-brass-400 flex h-[760px] max-h-[calc(100dvh-32px)] w-full max-w-[1080px] flex-col overflow-hidden rounded-xl p-0 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_input[type=checkbox]:focus-visible]:outline-2 [&_input[type=checkbox]:focus-visible]:outline-offset-2"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          searchRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          if (triggerRef?.current) {
            event.preventDefault()
            triggerRef.current.focus()
          }
        }}
      >
        <div className="border-carbon-700/60 flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Sliders aria-hidden className="text-brass-400 h-4 w-4" />
              <DialogHeader title="Indicators" className="mb-0 border-0 pb-0" />
            </div>
            <DialogDescription className="text-silver-300 mt-1 text-xs">
              Browse, preview, and configure chart indicators.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="surface-control text-silver-300 hover:text-silver-100 flex h-8 w-8 items-center justify-center rounded-md"
            aria-label="Close dialog"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside
            aria-label="Indicator catalog"
            className="bg-carbon-950/30 border-carbon-700/60 flex max-h-[200px] shrink-0 flex-col border-b md:max-h-none md:w-[270px] md:border-r md:border-b-0"
          >
            <div className="space-y-3 p-4">
              <div className="relative">
                <Search aria-hidden className="text-silver-300 absolute top-2.5 left-3 h-4 w-4" />
                <input
                  ref={searchRef}
                  type="search"
                  aria-label="Search indicators"
                  placeholder="Search indicators…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`${CONTROL_CLASS} pr-9 pl-9 text-xs [&::-webkit-search-cancel-button]:hidden`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      setSearchQuery('')
                      searchRef.current?.focus()
                    }}
                    className="text-silver-300 hover:text-silver-100 absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded"
                  >
                    <X aria-hidden className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-silver-300">{filtered.length} indicators</span>
                <button
                  type="button"
                  aria-pressed={enabledOnly}
                  onClick={() => setEnabledOnly((value) => !value)}
                  className={`surface-control rounded-md px-2 py-1 ${enabledOnly ? 'text-brass-400' : 'text-silver-200'}`}
                >
                  Enabled <span className="font-mono">{enabledCount}</span>
                </button>
              </div>
            </div>
            <div
              className="min-h-0 flex-1 space-y-5 overflow-y-auto px-2 pb-4"
              data-testid="indicator-catalog-list"
            >
              {catalogQuery.isPending && (
                <p role="status" className="text-silver-300 px-3 py-6 text-xs">
                  Loading indicators…
                </p>
              )}
              {catalogQuery.isError && (
                <div role="alert" className="space-y-3 px-3 py-4 text-xs">
                  <p className="text-rose-300">
                    {indicatorRequestErrorMessage(catalogQuery.error)}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => void catalogQuery.refetch()}>
                    Retry catalog
                  </Button>
                </div>
              )}
              {Array.from(grouped.entries()).map(([category, entries]) => (
                <section key={category}>
                  <h3 className="text-silver-300 mb-2 px-3 text-[10px] font-semibold tracking-[0.08em] uppercase">
                    {category}
                  </h3>
                  <div className="space-y-1">
                    {entries.map((entry) => {
                      const draft = draftById.get(entry.id)
                      const isSelected = activeEntry?.id === entry.id
                      return (
                        <div
                          key={entry.id}
                          className={`group flex items-center gap-1 rounded-lg border ${isSelected ? 'border-brass-500/25 bg-brass-500/10' : 'hover:bg-carbon-800/50 border-transparent'}`}
                        >
                          <button
                            type="button"
                            data-testid={`indicator-catalog-item-${entry.id}`}
                            aria-pressed={isSelected}
                            onClick={() => {
                              setSelectedId(entry.id)
                              if (detailRef.current) detailRef.current.scrollTop = 0
                            }}
                            className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium ${isSelected ? 'text-gold-400' : 'text-silver-200'}`}
                          >
                            <span className="min-w-0 flex-1">
                              {entry.label}
                              {additionalEnabled.has(entry.id) && (
                                <span className="text-silver-300 mt-1 block text-[10px]">
                                  {additionalEnabled.get(entry.id)} additional enabled
                                </span>
                              )}
                            </span>
                            {isSelected && (
                              <ChevronRight aria-hidden className="h-3 w-3 shrink-0" />
                            )}
                          </button>
                          <label
                            className="mr-2 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center"
                            title={`Enable ${entry.label}`}
                          >
                            <input
                              type="checkbox"
                              aria-label={`Enable ${entry.label}`}
                              checked={!!draft?.enabled}
                              onChange={(e) => updateDraft(entry.id, { enabled: e.target.checked })}
                              className="accent-brass-500 h-4 w-4 cursor-pointer"
                            />
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
              {!catalogQuery.isPending && !catalogQuery.isError && filtered.length === 0 && (
                <div className="text-silver-300 px-3 py-6 text-center text-xs">
                  <p>No indicators found.</p>
                  <p className="mt-2">
                    {enabledOnly
                      ? 'Enable an indicator or show the full catalog.'
                      : 'Try a name, category, or concept.'}
                  </p>
                </div>
              )}
            </div>
          </aside>

          <div ref={detailRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-5 md:px-7">
            {activeEntry && activeDraft ? (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-brass-400 mb-1 text-[10px] font-semibold tracking-[0.1em] uppercase">
                      {activeEntry.category}
                    </p>
                    <h3 className="text-silver-100 font-display text-2xl font-semibold tracking-tight">
                      {activeEntry.label}
                    </h3>
                    <p className="text-silver-200 mt-2 text-sm leading-relaxed">
                      {indicatorDocumentation[activeEntry.id]?.summary ??
                        'Explore this indicator with the current chart data.'}
                    </p>
                    <div className="text-silver-300 mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="border-carbon-700 rounded border px-2 py-1">
                        {activeEntry.pane === 'price' ? 'Price overlay' : 'Separate pane'}
                      </span>
                      <span className="border-carbon-700 rounded border px-2 py-1">
                        {activeEntry.requiredData === 'quotes' ? 'Requires quotes' : 'OHLCV data'}
                      </span>
                      {activeEntry.unit && (
                        <span className="border-carbon-700 rounded border px-2 py-1">
                          {activeEntry.unit}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`mt-1 flex shrink-0 items-center gap-1.5 text-xs ${activeDraft.enabled ? 'text-brass-400' : 'text-silver-300'}`}
                  >
                    {activeDraft.enabled && <Check aria-hidden className="h-3.5 w-3.5" />}
                    {activeDraft.enabled ? 'Enabled' : 'Not enabled'}
                  </span>
                </div>
                <IndicatorPreview
                  entry={activeEntry}
                  config={activeDraft}
                  context={previewContext}
                  invalid={Object.keys(activeErrors).length > 0}
                />
                <div
                  role="tablist"
                  aria-label="Indicator details"
                  className="border-carbon-700/60 bg-carbon-950 sticky top-0 z-10 mt-5 mb-5 flex gap-6 border-b pt-2"
                >
                  {(['settings', 'guide'] as const).map((value) => (
                    <button
                      key={value}
                      role="tab"
                      type="button"
                      id={`${id}-${value}-tab`}
                      aria-selected={tab === value}
                      aria-controls={`${id}-${value}-panel`}
                      tabIndex={tab === value ? 0 : -1}
                      onClick={() => switchTab(value)}
                      onKeyDown={handleTabKey}
                      className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-medium ${tab === value ? 'border-brass-400 text-gold-400' : 'text-silver-300 hover:text-silver-100 border-transparent'}`}
                    >
                      {value === 'settings' ? (
                        <Settings2 aria-hidden className="h-4 w-4" />
                      ) : (
                        <BookOpen aria-hidden className="h-4 w-4" />
                      )}
                      {value === 'settings' ? 'Settings' : 'Guide'}
                    </button>
                  ))}
                </div>
                <div
                  role="tabpanel"
                  id={`${id}-settings-panel`}
                  aria-labelledby={`${id}-settings-tab`}
                  hidden={tab !== 'settings'}
                  tabIndex={0}
                >
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-silver-100 text-sm font-semibold">Parameters</h4>
                      <button
                        type="button"
                        onClick={() =>
                          updateDraft(activeEntry.id, {
                            parameters: defaultParametersForEntry(activeEntry),
                          })
                        }
                        className="text-silver-300 hover:text-brass-400 flex items-center gap-1.5 rounded px-1 py-1 text-xs"
                      >
                        <RotateCcw aria-hidden className="h-3 w-3" />
                        Reset to defaults
                      </button>
                    </div>
                    {activeEntry.parameters.length === 0 && (
                      <p className="text-silver-300 text-sm">
                        This indicator has no configurable parameters.
                      </p>
                    )}
                    <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                      {activeEntry.parameters.map((spec) => {
                        const help = parameterHelp(spec.name)
                        const fieldId = `${id}-${activeEntry.id}-${spec.name}`
                        return (
                          <LabeledField
                            key={`${activeEntry.id}-${spec.name}`}
                            label={help.label}
                            htmlFor={fieldId}
                          >
                            <ParameterControl
                              spec={spec}
                              value={activeDraft.parameters[spec.name]}
                              id={fieldId}
                              error={activeErrors[spec.name]}
                              onChange={(value) =>
                                updateDraft(activeEntry.id, {
                                  parameters: { ...activeDraft.parameters, [spec.name]: value },
                                })
                              }
                            />
                            <p
                              id={`${fieldId}-help`}
                              className="text-silver-300 text-xs leading-relaxed"
                            >
                              {help.description}
                            </p>
                            {activeErrors[spec.name] && (
                              <p id={`${fieldId}-error`} className="text-xs text-rose-300">
                                {activeErrors[spec.name]}
                              </p>
                            )}
                          </LabeledField>
                        )
                      })}
                    </div>
                    {Object.entries(activeErrors)
                      .filter(
                        ([name]) => !activeEntry.parameters.some((spec) => spec.name === name),
                      )
                      .map(([name, message]) => (
                        <p key={name} className="text-xs text-rose-300">
                          {message}
                        </p>
                      ))}
                    <section className="border-carbon-700/60 border-t pt-5">
                      <h4 className="text-silver-100 text-sm font-semibold">Line color</h4>
                      <div
                        className="mt-3 flex flex-wrap items-center gap-2"
                        role="group"
                        aria-label="Indicator color"
                      >
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            aria-label={`${color.name} color`}
                            aria-pressed={(activeDraft.style?.color ?? '#c9a227') === color.value}
                            onClick={() =>
                              updateDraft(activeEntry.id, {
                                style: {
                                  ...activeDraft.style,
                                  color: color.value,
                                  outputColors: undefined,
                                },
                              })
                            }
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/20"
                            style={{ backgroundColor: color.value }}
                          >
                            {(activeDraft.style?.color ?? '#c9a227') === color.value && (
                              <Check aria-hidden className="text-carbon-950 h-4 w-4" />
                            )}
                          </button>
                        ))}
                        <span className="text-silver-300 ml-2 text-xs">
                          {PRESET_COLORS.find(
                            (color) => color.value === (activeDraft.style?.color ?? '#c9a227'),
                          )?.name ?? 'Custom color'}
                        </span>
                      </div>
                    </section>
                  </div>
                </div>
                <div
                  role="tabpanel"
                  id={`${id}-guide-panel`}
                  aria-labelledby={`${id}-guide-tab`}
                  hidden={tab !== 'guide'}
                  tabIndex={0}
                >
                  <IndicatorGuide entry={activeEntry} />
                </div>
              </>
            ) : (
              <p className="text-silver-300 py-6 text-sm">
                {catalogQuery.isPending
                  ? 'The indicator catalog is loading.'
                  : 'Select an indicator from the catalog.'}
              </p>
            )}
          </div>
        </div>

        <div className="border-carbon-700/60 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
          <div className="min-w-0 text-xs">
            <p className="text-silver-200">
              <span className="text-brass-400 font-mono">{enabledCount}</span>{' '}
              {enabledCount === 1 ? 'indicator' : 'indicators'} enabled
            </p>
            {invalidIds.length > 0 ? (
              <p role="status" className="mt-1 text-rose-300">
                Fix settings for{' '}
                {invalidIds
                  .map((entryId) => catalog.find((entry) => entry.id === entryId)?.label)
                  .join(', ')}{' '}
                before applying.
              </p>
            ) : (
              <p className="text-silver-300 mt-1">
                {preserved.length
                  ? 'Additional saved instances are preserved.'
                  : 'Changes apply when you’re ready.'}
              </p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="brass"
              size="sm"
              onClick={handleSave}
              disabled={catalogQuery.isPending || catalogQuery.isError || invalidIds.length > 0}
            >
              Apply changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function IndicatorsModal({ isOpen, ...props }: IndicatorsModalProps) {
  if (!isOpen) return null
  return <IndicatorsModalBody {...props} />
}
