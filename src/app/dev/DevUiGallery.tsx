import { useState, type ReactNode } from 'react'

import {
  EntityCard,
  FilterPills,
  LabeledField,
  Panel,
  PanelHeader,
  RangeChips,
  RangeInput,
  SectionHeader,
  SegmentedToggle,
  StatTile,
} from '@/components/ui'
import { wellInputClass } from '@/components/ui/wellInputStyles'

function GallerySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <SectionHeader title={title} />
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}

function StateCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-silver-500 text-[10px] font-semibold tracking-wide uppercase">{label}</p>
      {children}
    </div>
  )
}

export function DevUiGallery() {
  const [singleMode, setSingleMode] = useState<'any' | 'all' | 'majority'>('any')
  const [multiModes, setMultiModes] = useState<string[]>(['ema'])
  const [datePreset, setDatePreset] = useState('3M')
  const [filter, setFilter] = useState('all')
  const [entitySelected, setEntitySelected] = useState(false)
  const [range, setRange] = useState({ min: 10, max: 50, step: 5 as number | null })

  if (!import.meta.env.DEV) {
    return null
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-silver-100 text-2xl font-semibold">UI primitive gallery</h1>
        <p className="text-silver-400 text-sm">
          WO117 dev surface — every primitive on a real panel background.
        </p>
      </header>

      <Panel className="space-y-8 p-4">
        <PanelHeader title="Panel + PanelHeader" right="3 items" />

        <GallerySection title="SectionHeader">
          <StateCard label="Default">
            <SectionHeader title="Instrument & Modeling" right="Optional slot" />
          </StateCard>
        </GallerySection>

        <GallerySection title="LabeledField">
          <StateCard label="Default">
            <LabeledField label="Fast period" hint="Number of bars for the fast moving average.">
              <input className={wellInputClass} defaultValue="12" aria-label="Fast period" />
            </LabeledField>
          </StateCard>
          <StateCard label="Error">
            <LabeledField label="Slow period" error="Must be greater than fast period.">
              <input className={wellInputClass} defaultValue="4" aria-label="Slow period" />
            </LabeledField>
          </StateCard>
        </GallerySection>

        <GallerySection title="SegmentedToggle">
          <StateCard label="Single select">
            <SegmentedToggle
              aria-label="Entry manager mode"
              options={[
                { value: 'any', label: 'Any (OR)' },
                { value: 'all', label: 'All (AND)' },
                { value: 'majority', label: 'Majority' },
              ]}
              value={singleMode}
              onChange={setSingleMode}
            />
          </StateCard>
          <StateCard label="Multi select">
            <SegmentedToggle
              mode="multi"
              aria-label="Moving average types"
              options={[
                { value: 'ema', label: 'EMA' },
                { value: 'hma', label: 'HMA' },
                { value: 'sma', label: 'SMA' },
              ]}
              values={multiModes}
              onToggle={(value) =>
                setMultiModes((current) =>
                  current.includes(value)
                    ? current.filter((item) => item !== value)
                    : [...current, value],
                )
              }
            />
          </StateCard>
        </GallerySection>

        <GallerySection title="RangeChips">
          <StateCard label="Presets">
            <RangeChips
              options={[
                { value: '1M', label: '1M', title: 'Last 1 month' },
                { value: '3M', label: '3M', title: 'Last 3 months' },
                { value: '6M', label: '6M' },
                { value: '1Y', label: '1Y' },
                { value: 'YTD', label: 'YTD' },
                { value: 'ALL', label: 'All' },
              ]}
              value={datePreset}
              onSelect={setDatePreset}
            />
          </StateCard>
        </GallerySection>

        <GallerySection title="FilterPills">
          <StateCard label="Categories">
            <FilterPills
              options={[
                { value: 'all', label: 'All' },
                { value: 'trend', label: 'Trend' },
                { value: 'mean-reversion', label: 'Mean reversion' },
                { value: 'breakout', label: 'Breakout' },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </StateCard>
        </GallerySection>

        <GallerySection title="EntityCard">
          <StateCard label="Default">
            <EntityCard
              title="Dual MA crossover"
              tag="Trend"
              description="Classic fast/slow moving-average crossover with configurable periods."
              meta="4 params"
              selected={false}
              onSelect={() => undefined}
            />
          </StateCard>
          <StateCard label="Selected">
            <EntityCard
              title="RSI mean reversion"
              tag="Mean reversion"
              description="Buys oversold and sells overbought using RSI thresholds."
              meta="3 params"
              selected={entitySelected}
              onSelect={() => setEntitySelected((value) => !value)}
            />
          </StateCard>
          <StateCard label="Disabled">
            <EntityCard
              title="Locked strategy"
              description="Unavailable in the current workspace."
              selected={false}
              disabled
              onSelect={() => undefined}
            />
          </StateCard>
        </GallerySection>

        <GallerySection title="RangeInput">
          <StateCard label="Default">
            <RangeInput min={range.min} max={range.max} step={range.step} onChange={setRange} />
          </StateCard>
          <StateCard label="Error">
            <RangeInput
              min={80}
              max={20}
              step={0}
              onChange={() => undefined}
              error="Custom range validation failed."
            />
          </StateCard>
        </GallerySection>

        <GallerySection title="StatTile">
          <StateCard label="Neutral">
            <StatTile label="Completed trials" value="128" />
          </StateCard>
          <StateCard label="Delta up">
            <StatTile label="Net profit" value="+12.4%" delta="+2.1% vs prior" deltaTone="up" />
          </StateCard>
          <StateCard label="Delta down">
            <StatTile label="Max drawdown" value="-8.2%" delta="-1.4% vs prior" deltaTone="down" />
          </StateCard>
        </GallerySection>
      </Panel>
    </div>
  )
}
