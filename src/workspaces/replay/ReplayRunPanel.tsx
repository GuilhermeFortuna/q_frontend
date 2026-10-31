import { useState } from 'react'

import {
  replayErrorMessage,
  useOpenReplayTerminal,
  useReplayCommand,
  useReplayJournal,
  useStopReplayStack,
  type ReplayCommandInput,
} from '@/api/queries/replay'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/Callout'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { StatTile } from '@/components/ui/StatTile'
import { wellInputClass } from '@/components/ui/wellInputStyles'
import type { ReplayOverview } from '@/types/replay'
import {
  parseSpeed,
  parseStepMarketMs,
  SPEED_MAX,
  SPEED_MIN,
  STEP_MAX_MINUTES,
  transportState,
} from '@/workspaces/replay/replayControls'
import { ReplayJournal } from '@/workspaces/replay/ReplayJournal'
import { formatExchangeTime, formatUtcTime } from '@/workspaces/replay/replayTime'

type Feedback = { tone: 'info' | 'warning' | 'error'; text: string }
type Armed = 'end' | 'shutdown' | null

const REASON_TEXT: Record<string, string> = {
  stale_revision:
    'The run changed since this view was loaded, so the status was refreshed. Repeat the action if it still applies.',
  invalid_transition: 'That action is not valid in the run’s current state.',
  step_requires_pause: 'Step runs only while the run is paused.',
  invalid_rate: `Speed must be between ${SPEED_MIN} and ${SPEED_MAX}.`,
  run_not_active: 'The run is not active.',
  queue_limit: 'The run’s event queue is full; wait for it to drain.',
}

function reasonText(reason: string | null): string {
  return (
    (reason && REASON_TEXT[reason]) ||
    `The simulator refused the command (${reason ?? 'unknown reason'}).`
  )
}

type ReplayRunPanelProps = {
  overview: ReplayOverview
  pollMs: number
}

export function ReplayRunPanel({ overview, pollMs }: ReplayRunPanelProps) {
  const run = overview.run
  const transport = transportState(overview)
  const command = useReplayCommand()
  const stack = useStopReplayStack()
  const terminal = useOpenReplayTerminal()
  const journal = useReplayJournal(run?.generation ?? null, pollMs)

  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [armed, setArmed] = useState<Armed>(null)
  const [speedText, setSpeedText] = useState('1')
  const [stepText, setStepText] = useState('1')

  const send = (input: ReplayCommandInput, done: string) => {
    setArmed(null)
    command.mutate(input, {
      onSuccess: (result) =>
        setFeedback(
          result.accepted
            ? { tone: 'info', text: done }
            : { tone: 'warning', text: reasonText(result.reason) },
        ),
      onError: (error) => setFeedback({ tone: 'error', text: replayErrorMessage(error) }),
    })
  }

  const busy = overview.phase === 'starting' || overview.phase === 'stopping'
  const revision = run?.revision ?? 0

  const applySpeed = () => {
    const rate = parseSpeed(speedText)
    if (rate === null) {
      setFeedback({ tone: 'warning', text: `Speed must be between ${SPEED_MIN} and ${SPEED_MAX}.` })
      return
    }
    send({ action: 'speed', expectedRevision: revision, rate }, `Speed set to ${rate}×.`)
  }

  const applyStep = () => {
    const marketMs = parseStepMarketMs(stepText)
    if (marketMs === null) {
      setFeedback({
        tone: 'warning',
        text: `Step is a whole number of minutes from 1 to ${STEP_MAX_MINUTES}.`,
      })
      return
    }
    send(
      { action: 'step', expectedRevision: revision, marketMs },
      `Stepped ${stepText} market minute(s).`,
    )
  }

  const shutdown = () => {
    setArmed(null)
    stack.mutate(undefined, {
      onSuccess: () =>
        setFeedback({
          tone: 'info',
          text: 'Shutting down the replay stack. The run record is kept.',
        }),
      onError: (error) => setFeedback({ tone: 'error', text: replayErrorMessage(error) }),
    })
  }

  const openTerminal = () => {
    terminal.mutate(undefined, {
      onSuccess: () =>
        setFeedback({ tone: 'info', text: 'q_terminal is opening on the replay stack.' }),
      onError: (error) => setFeedback({ tone: 'error', text: replayErrorMessage(error) }),
    })
  }

  return (
    <div className="space-y-4">
      {busy ? (
        <Callout
          type="info"
          title={overview.phase === 'starting' ? 'Starting the replay stack' : 'Shutting down'}
        >
          Controls are disabled until the launcher finishes.
        </Callout>
      ) : null}

      <Panel className="space-y-4 p-4">
        <PanelHeader title="Transport" />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="brass"
            disabled={!transport.resume}
            onClick={() => send({ action: 'resume', expectedRevision: revision }, 'Run resumed.')}
          >
            Resume
          </Button>
          <Button
            variant="outline"
            disabled={!transport.pause}
            onClick={() => send({ action: 'pause', expectedRevision: revision }, 'Run paused.')}
          >
            Pause
          </Button>
          <Button variant="outline" disabled={!transport.openTerminal} onClick={openTerminal}>
            Open q_terminal
          </Button>
          {overview.terminal_running ? (
            <span className="text-silver-400 text-xs">q_terminal is running.</span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-end gap-2">
            <label className="text-silver-300 flex-1 space-y-1 text-xs" htmlFor="replay-speed">
              Speed ({SPEED_MIN}–{SPEED_MAX}×)
              <input
                id="replay-speed"
                inputMode="decimal"
                className={wellInputClass}
                value={speedText}
                onChange={(event) => setSpeedText(event.target.value)}
                disabled={!transport.speed}
              />
            </label>
            <Button variant="outline" disabled={!transport.speed} onClick={applySpeed}>
              Apply speed
            </Button>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-silver-300 flex-1 space-y-1 text-xs" htmlFor="replay-step">
              Step (market minutes, paused only)
              <input
                id="replay-step"
                inputMode="numeric"
                className={wellInputClass}
                value={stepText}
                onChange={(event) => setStepText(event.target.value)}
                disabled={!transport.step}
              />
            </label>
            <Button variant="outline" disabled={!transport.step} onClick={applyStep}>
              Step
            </Button>
          </div>
        </div>

        <div className="border-silver-700/30 flex flex-wrap items-center gap-2 border-t pt-3">
          {armed === 'end' ? (
            <Button
              variant="outline"
              onClick={() => send({ action: 'stop', expectedRevision: revision }, 'Run ended.')}
            >
              Confirm end run
            </Button>
          ) : (
            <Button variant="outline" disabled={!transport.endRun} onClick={() => setArmed('end')}>
              End run
            </Button>
          )}
          {armed === 'shutdown' ? (
            <Button variant="outline" onClick={shutdown}>
              Confirm shut down stack
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={!transport.shutdown}
              onClick={() => setArmed('shutdown')}
            >
              Shut down stack
            </Button>
          )}
          {armed ? (
            <Button variant="ghost" onClick={() => setArmed(null)}>
              Cancel
            </Button>
          ) : null}
        </div>

        {feedback ? (
          <p
            role="status"
            className={
              feedback.tone === 'error'
                ? 'text-sm text-rose-300'
                : feedback.tone === 'warning'
                  ? 'text-sm text-amber-300'
                  : 'text-silver-200 text-sm'
            }
          >
            {feedback.text}
          </p>
        ) : null}
      </Panel>

      <Panel className="space-y-4 p-4">
        <PanelHeader title="Status" />
        {run ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="State" value={run.state} />
              <StatTile label="Rate" value={`${run.rate}×`} />
              <StatTile label="Revision" value={String(run.revision)} />
              <StatTile label="Generation" value={run.generation} />
              <StatTile
                label="Canonical cursor (BRT)"
                value={formatExchangeTime(run.canonical_cursor_utc)}
              />
              <StatTile
                label="Canonical cursor (UTC)"
                value={formatUtcTime(run.canonical_cursor_utc)}
              />
              <StatTile
                label="Visible cursor (BRT)"
                value={formatExchangeTime(run.visible_cursor_utc)}
              />
              <StatTile
                label="Visible cursor (UTC)"
                value={formatUtcTime(run.visible_cursor_utc)}
              />
              <StatTile label="Lag (ms)" value={String(run.lag_ms)} />
              <StatTile label="Queue depth" value={String(run.queue_depth)} />
              <StatTile label="Outstanding intents" value={String(run.outstanding_intents)} />
              <StatTile label="Config hash" value={run.config_hash.slice(0, 19)} />
            </div>
            {run.fixed_latency ? (
              <p className="text-silver-400 text-xs">
                Fixed latency (market ms): market data {run.fixed_latency.market_data_ms}, order
                transport {run.fixed_latency.order_transport_ms}, broker accept{' '}
                {run.fixed_latency.broker_accept_ms}, broker execution{' '}
                {run.fixed_latency.broker_execution_ms}, broker response{' '}
                {run.fixed_latency.broker_response_ms}.
              </p>
            ) : null}
            {run.last_error ? (
              <Callout type="error" title="Run failed">
                {run.last_error}
              </Callout>
            ) : null}
          </>
        ) : (
          <p className="text-silver-400 text-sm">
            No run is loaded. Shut the stack down to start over, or wait for the launcher to report.
          </p>
        )}
      </Panel>

      <Panel className="space-y-3 p-4">
        <PanelHeader title="Journal" />
        <ReplayJournal rows={journal.rows} error={journal.error} />
      </Panel>
    </div>
  )
}
