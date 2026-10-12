import { useEffect, useMemo, useState } from 'react'
import { X, Search, Sliders } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { NumberInput } from '@/components/ui/number-input'
import { useIndicatorCatalog } from '@/api/queries/marketIndicators'
import {
  defaultParametersForEntry,
  indicatorInstanceKey,
  type IndicatorConfig,
} from '@/lib/market/indicatorConfig'
import type { IndicatorCatalogEntry, IndicatorParameterSpec } from '../../../contracts/api'

type IndicatorsModalProps = {
  isOpen: boolean
  onClose: () => void
  indicators: IndicatorConfig[]
  onChange: (indicators: IndicatorConfig[]) => void
}

const PRESET_COLORS = ['#c9a227', '#6eb5ff', '#a78bfa', '#f97316', '#26a69a', '#ef5350']

function ParameterControl({
  spec,
  value,
  onChange,
}: {
  spec: IndicatorParameterSpec
  value: number | string | undefined
  onChange: (next: number | string) => void
}) {
  if (spec.choices && spec.choices.length > 0) {
    return (
      <select
        value={String(value ?? spec.default ?? spec.choices[0])}
        onChange={(event) => onChange(event.target.value)}
        className="bg-carbon-950 border-carbon-800/80 text-silver-200 w-full rounded-md border px-2 py-1 text-xs"
      >
        {spec.choices.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
    )
  }

  if (spec.type === 'float' || spec.type === 'int') {
    return (
      <NumberInput
        value={typeof value === 'number' ? value : Number(spec.default ?? 0)}
        onChange={(next) => onChange(next)}
        min={spec.minimum ?? undefined}
        max={spec.maximum ?? undefined}
        step={spec.type === 'int' ? 1 : 0.1}
        className="w-full"
      />
    )
  }

  return (
    <input
      type="text"
      value={String(value ?? spec.default ?? '')}
      onChange={(event) => onChange(event.target.value)}
      className="bg-carbon-950 border-carbon-800/80 text-silver-200 w-full rounded-md border px-2 py-1 text-xs"
    />
  )
}

function buildDraftFromSelection(
  catalog: IndicatorCatalogEntry[],
  selected: IndicatorConfig[],
): Map<string, IndicatorConfig> {
  const map = new Map<string, IndicatorConfig>()
  for (const entry of catalog) {
    const existing = selected.find((item) => item.id === entry.id)
    map.set(
      entry.id,
      existing ?? {
        id: entry.id,
        enabled: false,
        parameters: defaultParametersForEntry(entry),
      },
    )
  }
  return map
}

function IndicatorsModalBody({
  onClose,
  indicators,
  onChange,
}: Omit<IndicatorsModalProps, 'isOpen'>) {
  const catalogQuery = useIndicatorCatalog()
  const catalog = catalogQuery.data?.indicators ?? []

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState('sma')
  const [draftById, setDraftById] = useState<Map<string, IndicatorConfig>>(() => new Map())

  useEffect(() => {
    if (catalog.length === 0) return
    setDraftById(buildDraftFromSelection(catalog, indicators))
    if (!catalog.some((entry) => entry.id === selectedId)) {
      setSelectedId(catalog[0]?.id ?? 'sma')
    }
  }, [catalog, indicators, selectedId])

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return catalog
    return catalog.filter(
      (entry) =>
        entry.label.toLowerCase().includes(query) ||
        entry.id.toLowerCase().includes(query) ||
        entry.category.toLowerCase().includes(query),
    )
  }, [catalog, searchQuery])

  const grouped = useMemo(() => {
    const groups = new Map<string, IndicatorCatalogEntry[]>()
    for (const entry of filtered) {
      const list = groups.get(entry.category) ?? []
      list.push(entry)
      groups.set(entry.category, list)
    }
    return groups
  }, [filtered])

  const activeEntry = catalog.find((entry) => entry.id === selectedId)
  const activeDraft = draftById.get(selectedId)

  const updateDraft = (id: string, patch: Partial<IndicatorConfig>) => {
    setDraftById((prev) => {
      const next = new Map(prev)
      const current = next.get(id)
      if (!current) return prev
      next.set(id, { ...current, ...patch })
      return next
    })
  }

  const updateParameter = (id: string, name: string, value: number | string) => {
    setDraftById((prev) => {
      const next = new Map(prev)
      const current = next.get(id)
      if (!current) return prev
      next.set(id, {
        ...current,
        parameters: { ...current.parameters, [name]: value },
      })
      return next
    })
  }

  const handleSave = () => {
    const next = Array.from(draftById.values()).filter((item) => item.enabled)
    onChange(next)
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(val) => {
        if (!val) onClose()
      }}
    >
      <DialogContent className="flex h-[580px] w-full max-w-4xl flex-col overflow-hidden rounded-xl p-0 select-none">
        <div className="border-carbon-800/80 flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <Sliders className="text-brass-400 h-4.5 w-4.5" />
            <h2 className="text-silver-100 font-sans text-sm font-bold tracking-wider uppercase">
              Indicators
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-silver-400 hover:text-silver-100 bg-carbon-800/20 hover:bg-carbon-800/60 cursor-pointer rounded-full p-1 transition-all duration-150 active:scale-90"
            aria-label="Close dialog"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="border-carbon-800/60 bg-carbon-950/30 flex w-72 flex-col border-r">
            <div className="p-3">
              <div className="relative flex items-center">
                <Search className="text-silver-500 absolute left-2.5 h-3.5 w-3.5" />
                <input
                  type="text"
                  placeholder="Search indicators..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="bg-carbon-950 border-carbon-800/80 text-silver-200 placeholder-silver-500 focus:border-brass-500/40 focus:ring-brass-500/10 w-full rounded-md border py-1.5 pr-3 pl-8 text-xs transition-all outline-none focus:ring-1"
                />
              </div>
            </div>

            <div
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-3 font-sans"
              data-testid="indicator-catalog-list"
            >
              {Array.from(grouped.entries()).map(([category, entries]) => (
                <div key={category} className="space-y-1">
                  <span className="text-silver-500 block px-2 text-[9px] font-bold tracking-wider uppercase">
                    {category}
                  </span>
                  <div className="space-y-0.5">
                    {entries.map((entry) => {
                      const draft = draftById.get(entry.id)
                      const isSelected = selectedId === entry.id
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          data-testid={`indicator-catalog-item-${entry.id}`}
                          onClick={() => setSelectedId(entry.id)}
                          className={`flex w-full cursor-pointer items-center justify-between rounded px-2.5 py-1.5 text-left transition-all duration-150 ${
                            isSelected
                              ? 'bg-brass-500/10 text-brass-400 border-brass-500/15 border'
                              : 'hover:bg-carbon-850/40 text-silver-300 border border-transparent'
                          }`}
                        >
                          <span className="truncate text-xs font-medium">{entry.label}</span>
                          <input
                            type="checkbox"
                            checked={!!draft?.enabled}
                            onChange={(event) => {
                              event.stopPropagation()
                              updateDraft(entry.id, { enabled: event.target.checked })
                            }}
                            className="accent-brass-500 border-carbon-700 h-3.5 w-3.5 cursor-pointer rounded focus:ring-0"
                          />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-silver-500 py-8 text-center text-xs">No indicators found.</div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col space-y-4 overflow-y-auto p-5">
            {activeEntry && activeDraft ? (
              <>
                <div className="space-y-1">
                  <h3 className="text-silver-100 font-sans text-base font-bold tracking-wide">
                    {activeEntry.label}
                  </h3>
                  <p className="text-silver-500 font-mono text-[10px]">
                    {activeEntry.id} · {activeEntry.pane} pane · {activeEntry.requiredData}
                  </p>
                </div>

                <div className="space-y-3">
                  {activeEntry.parameters.map((spec) => (
                    <label key={spec.name} className="block space-y-1">
                      <span className="text-silver-400 text-[10px] font-bold tracking-wider uppercase">
                        {spec.name}
                      </span>
                      <ParameterControl
                        spec={spec}
                        value={activeDraft.parameters[spec.name]}
                        onChange={(value) => updateParameter(selectedId, spec.name, value)}
                      />
                    </label>
                  ))}
                </div>

                <div className="space-y-2">
                  <span className="text-silver-500 text-[9px] font-bold tracking-wider uppercase">
                    Style
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Color ${color}`}
                        onClick={() =>
                          updateDraft(selectedId, {
                            style: { ...activeDraft.style, color },
                          })
                        }
                        className="h-6 w-6 rounded-full border border-white/10"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-silver-500 font-mono text-[10px]">
                  Instance key: {indicatorInstanceKey(activeDraft)}
                </p>
              </>
            ) : (
              <p className="text-silver-500 text-sm">Select an indicator from the catalog.</p>
            )}
          </div>
        </div>

        <div className="border-carbon-800/80 flex items-center justify-end gap-2 border-t px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="text-silver-400 hover:text-silver-200 rounded-md px-3 py-1.5 text-xs font-bold uppercase"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="bg-brass-500/20 text-brass-400 border-brass-500/30 hover:bg-brass-500/30 rounded-md border px-3 py-1.5 text-xs font-bold uppercase"
          >
            Apply
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function IndicatorsModal({ isOpen, onClose, indicators, onChange }: IndicatorsModalProps) {
  if (!isOpen) return null
  return <IndicatorsModalBody onClose={onClose} indicators={indicators} onChange={onChange} />
}
