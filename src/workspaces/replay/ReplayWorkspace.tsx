import {
  isReplayUnavailable,
  replayErrorMessage,
  replayOverviewPollMs,
  useReplayOverview,
} from '@/api/queries/replay'
import { Callout } from '@/components/ui/Callout'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import type { ReplayOverview, ReplayPhase } from '@/types/replay'
import { ReplayDatasets } from '@/workspaces/replay/ReplayDatasets'
import { ReplayRunForm } from '@/workspaces/replay/ReplayRunForm'
import { ReplayRunPanel } from '@/workspaces/replay/ReplayRunPanel'
import { useState } from 'react'

const PHASE_LABEL: Record<ReplayPhase, string> = {
  idle: 'Stack idle',
  starting: 'Starting stack',
  ready: 'Stack ready',
  stopping: 'Stopping stack',
  failed: 'Failed',
}

function PhaseBadge({ phase }: { phase: ReplayPhase }) {
  const tone =
    phase === 'ready'
      ? 'text-emerald-300 border-emerald-500/40'
      : phase === 'failed'
        ? 'text-rose-300 border-rose-500/40'
        : 'text-silver-300 border-silver-500/30'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${tone}`}
      data-testid="replay-phase"
    >
      {PHASE_LABEL[phase]}
    </span>
  )
}

export function ReplayUnavailable() {
  return (
    <Callout type="info" title="Replay control is not available">
      This Research API does not serve replay routes. Replay runs only with the host-mode Research
      stack (`./dev research` or `./dev`). Container mode and the live API never expose replay.
    </Callout>
  )
}

export function ReplayWorkspace() {
  const overview = useReplayOverview()
  const [datasetId, setDatasetId] = useState('')

  if (overview.isPending) {
    return <p className="text-silver-400 p-6 text-sm">Loading replay status…</p>
  }
  if (overview.isError && isReplayUnavailable(overview.error)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-silver-100 text-xl font-semibold">Replay</h1>
        <ReplayUnavailable />
      </div>
    )
  }
  if (overview.isError || !overview.data) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-silver-100 text-xl font-semibold">Replay</h1>
        <Callout type="error" title="Replay status unavailable">
          {replayErrorMessage(overview.error)}
        </Callout>
      </div>
    )
  }

  const data: ReplayOverview = overview.data
  const idle = data.phase === 'idle'

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-silver-100 text-xl font-semibold">Replay</h1>
          <p className="text-silver-400 text-sm">
            Historical market and simulated demo broker. Deployments stay in q_terminal.
          </p>
        </div>
        <PhaseBadge phase={data.phase} />
      </header>

      {data.last_error ? (
        <Callout type="error" title="Last replay operation failed">
          {data.last_error}
        </Callout>
      ) : null}

      {idle ? (
        <>
          <Panel className="space-y-4 p-4">
            <PanelHeader title="1. Dataset" />
            <ReplayDatasets selectedId={datasetId} onSelect={setDatasetId} />
          </Panel>
          <Panel className="space-y-4 p-4">
            <PanelHeader title="2. Run" />
            <ReplayRunForm datasetId={datasetId} />
          </Panel>
        </>
      ) : (
        <ReplayRunPanel overview={data} pollMs={replayOverviewPollMs(data.phase)} />
      )}
    </div>
  )
}
