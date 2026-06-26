import { Loader2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { useFeaturePassport, useSetFeatureStatus } from '@/api/queries/features'
import {
  categoryLabel,
  formatFeatureScore,
  statusChipClass,
} from '@/components/research/featureStoreUtils'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/Callout'
import { LabeledField } from '@/components/ui/LabeledField'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { StatTile } from '@/components/ui/StatTile'
import { formatDisplayDateTime } from '@/lib/formatDate'
import { cn } from '@/lib/utils'
import type {
  FeaturePassportEvaluationEntry,
  FeatureStatus,
  FeatureVersionDetail,
} from '@/types/features'

const STATUS_OPTIONS: { value: FeatureStatus; label: string }[] = [
  { value: 'experimental', label: 'Experimental' },
  { value: 'candidate', label: 'Candidate' },
  { value: 'production', label: 'Production' },
]

type FeaturePassportProps = {
  name: string
  onClose?: () => void
}

function ReadOnlyValue({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return (
    <p
      className={cn(
        'bg-carbon-950/60 border-carbon-800/60 text-silver-200 hover:border-carbon-700/60 rounded-lg border px-3 py-2.5 text-xs leading-relaxed font-medium transition-all duration-200',
        mono && 'font-mono',
      )}
    >
      {children}
    </p>
  )
}

function leakageBadgeClass(status: string): string {
  const base =
    'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase'

  if (status === 'clean') {
    return cn(base, 'bg-emerald-500/10 text-emerald-300')
  }
  return cn(base, 'bg-brass-500/15 text-brass-300')
}

function formatMetric(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—'
  }
  return value.toFixed(2)
}

function provenanceValue(provenance: Record<string, unknown>, key: string): string {
  const value = provenance[key]
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  return String(value)
}

function extractEvalCoverage(history: FeaturePassportEvaluationEntry[]) {
  const symbols = new Set<string>()
  const timeframes = new Set<string>()

  for (const entry of history) {
    if (entry.symbol) {
      symbols.add(entry.symbol)
    }
    if (entry.timeframe) {
      timeframes.add(entry.timeframe)
    }
  }

  return {
    symbols: [...symbols].sort(),
    timeframes: [...timeframes].sort(),
  }
}

function activeVersion(versions: FeatureVersionDetail[]): FeatureVersionDetail | null {
  if (versions.length === 0) {
    return null
  }
  return [...versions].sort((left, right) => right.version - left.version)[0] ?? null
}

export function FeaturePassport({ name, onClose }: FeaturePassportProps) {
  const passportQuery = useFeaturePassport(name)
  const setFeatureStatus = useSetFeatureStatus()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const passport = passportQuery.data
  const latestVersion = passport ? activeVersion(passport.versions) : null

  const sortedHistory = useMemo(() => {
    if (!passport) {
      return []
    }
    return [...passport.evaluation_history].sort(
      (left, right) =>
        new Date(right.evaluated_at).getTime() - new Date(left.evaluated_at).getTime(),
    )
  }, [passport])

  const coverage = useMemo(() => extractEvalCoverage(sortedHistory), [sortedHistory])

  useEffect(() => {
    setStatusMessage(null)
    setStatusError(null)
  }, [name])

  const handleStatusChange = (nextStatus: FeatureStatus) => {
    if (!passport || !latestVersion) {
      return
    }

    setStatusMessage(null)
    setStatusError(null)

    setFeatureStatus.mutate(
      {
        name: passport.name,
        version: latestVersion.version,
        status: nextStatus,
      },
      {
        onSuccess: () => {
          setStatusMessage(`Status updated to ${nextStatus}.`)
        },
        onError: () => {
          setStatusError('Failed to update feature status.')
        },
      },
    )
  }

  if (passportQuery.isLoading) {
    return (
      <Panel
        className="flex h-full w-full max-w-md shrink-0 flex-col p-4 lg:w-96"
        data-testid="feature-passport"
      >
        <div className="text-silver-400 flex flex-1 items-center justify-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading passport…
        </div>
      </Panel>
    )
  }

  if (passportQuery.isError || !passport || !latestVersion) {
    return (
      <Panel
        className="flex h-full w-full max-w-md shrink-0 flex-col p-4 lg:w-96"
        data-testid="feature-passport"
      >
        <div className="flex flex-1 items-center justify-center text-sm text-rose-400">
          Failed to load feature passport.
        </div>
      </Panel>
    )
  }

  const leakageStatus = latestVersion.leakage_status

  return (
    <Panel
      className="flex h-full w-full max-w-md shrink-0 flex-col overflow-hidden lg:w-96"
      data-testid="feature-passport"
    >
      <PanelHeader
        title="Feature Passport"
        right={
          onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close passport"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null
        }
      />

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-cream-100 font-mono text-lg font-semibold">{passport.name}</h2>
            <span className="text-silver-400 text-xs capitalize">
              {categoryLabel(passport.category)}
            </span>
            <span
              className={leakageBadgeClass(leakageStatus)}
              data-testid="feature-passport-leakage-badge"
            >
              Leakage: {leakageStatus}
            </span>
          </div>
          <StatTile
            label="Global score"
            value={formatFeatureScore(passport.score)}
            highlight={passport.score !== null && passport.score !== undefined}
          />
        </div>

        {statusMessage ? (
          <Callout type="success" data-testid="feature-passport-status-message">
            {statusMessage}
          </Callout>
        ) : null}
        {statusError ? (
          <Callout type="error" data-testid="feature-passport-status-error">
            {statusError}
          </Callout>
        ) : null}

        <section className="space-y-3">
          <SectionHeader title="Definition" />
          <LabeledField label="Description">
            <ReadOnlyValue>{passport.description ?? '—'}</ReadOnlyValue>
          </LabeledField>
          <LabeledField label="Node kind">
            <ReadOnlyValue mono>{latestVersion.node_kind}</ReadOnlyValue>
          </LabeledField>
          <LabeledField label="Inputs (param keys)">
            <ReadOnlyValue mono>
              {latestVersion.param_keys.length > 0 ? latestVersion.param_keys.join(', ') : '—'}
            </ReadOnlyValue>
          </LabeledField>
          <LabeledField label="Default params">
            <ReadOnlyValue mono>
              {JSON.stringify(latestVersion.default_params, null, 2)}
            </ReadOnlyValue>
          </LabeledField>
          <LabeledField label="Forward window">
            <ReadOnlyValue mono>
              <span data-testid="feature-passport-forward-window">
                {latestVersion.forward_window}
              </span>
            </ReadOnlyValue>
          </LabeledField>
        </section>

        <section className="space-y-3">
          <SectionHeader title="Versions" />
          <div className="space-y-2">
            {passport.versions
              .slice()
              .sort((left, right) => right.version - left.version)
              .map((versionRow) => (
                <div
                  key={versionRow.version}
                  className="surface-card flex items-center justify-between rounded-lg px-3.5 py-2.5"
                >
                  <span className="text-silver-200 font-mono text-sm">v{versionRow.version}</span>
                  <span className={statusChipClass(versionRow.status)}>{versionRow.status}</span>
                </div>
              ))}
          </div>
          <LabeledField label="Active version status">
            <SegmentedToggle
              aria-label="Feature lifecycle status"
              options={STATUS_OPTIONS}
              value={latestVersion.status}
              onChange={handleStatusChange}
            />
          </LabeledField>
        </section>

        <section className="space-y-3">
          <SectionHeader title="Provenance" />
          <LabeledField label="Author / model">
            <ReadOnlyValue>{provenanceValue(latestVersion.provenance, 'author')}</ReadOnlyValue>
          </LabeledField>
          <LabeledField label="Source WO">
            <ReadOnlyValue mono>
              {provenanceValue(latestVersion.provenance, 'source_wo')}
            </ReadOnlyValue>
          </LabeledField>
          <LabeledField label="Created">
            <ReadOnlyValue>
              {latestVersion.provenance.created_at
                ? formatDisplayDateTime(String(latestVersion.provenance.created_at))
                : '—'}
            </ReadOnlyValue>
          </LabeledField>
        </section>

        <section className="space-y-3">
          <SectionHeader title="Evaluation history" />
          {sortedHistory.length === 0 ? (
            <p className="text-silver-400 text-sm" data-testid="feature-passport-no-evaluations">
              No evaluations yet.
            </p>
          ) : (
            <div className="space-y-2">
              {sortedHistory.map((entry) => (
                <div key={entry.run_id} className="surface-card rounded-lg px-3.5 py-2.5 text-xs">
                  <div className="text-silver-300 flex items-center justify-between gap-2">
                    <span className="font-mono">{entry.run_id}</span>
                    <span>{formatDisplayDateTime(entry.evaluated_at)}</span>
                  </div>
                  <div className="text-silver-400 mt-1 grid grid-cols-3 gap-2">
                    <span>Target: {entry.target}</span>
                    <span>Rank IC: {formatMetric(entry.rank_ic)}</span>
                    <span>Score: {formatMetric(entry.global_score)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeader title="Best symbols / timeframes" />
          {sortedHistory.length === 0 ? (
            <p className="text-silver-400 text-sm">No evaluations yet.</p>
          ) : coverage.symbols.length === 0 && coverage.timeframes.length === 0 ? (
            <p className="text-silver-400 text-sm">
              Evaluation history does not include symbol or timeframe coverage yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile
                label="Symbols"
                value={coverage.symbols.length > 0 ? coverage.symbols.join(', ') : '—'}
              />
              <StatTile
                label="Timeframes"
                value={coverage.timeframes.length > 0 ? coverage.timeframes.join(', ') : '—'}
              />
            </div>
          )}
        </section>
      </div>
    </Panel>
  )
}
