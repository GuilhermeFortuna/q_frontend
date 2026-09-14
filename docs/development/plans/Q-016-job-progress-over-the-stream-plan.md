# Q-016 implementation plan: Job progress over the stream

**Status:** authoritative in the [Q project board](https://github.com/users/GuilhermeFortuna/projects/2)  
**Specification:** [`../specs/Q-016-job-progress-over-the-stream-spec.md`](../specs/Q-016-job-progress-over-the-stream-spec.md)  
**Depends on:** Q-014, Q-015

## Current-system context

Server state lives in TanStack Query v5 (`@tanstack/react-query ^5.62.8`). The
Axios client is `src/api/client.ts` (`baseURL: env.apiBaseUrl`, default
`http://127.0.0.1:8000`), and `src/lib/env.ts` also exposes `enableMsw`, which is
true in development unless `VITE_ENABLE_MSW=false`. Nine job status hooks poll
through a `refetchInterval` function that stops at terminal states:

| Hook                      | File                                                                        |
| ------------------------- | --------------------------------------------------------------------------- |
| `useBacktestJobStatus`    | `src/api/queries/backtests.ts:139` (1000 ms while `running`)                |
| `useOptimizationStatus`   | `src/api/queries/optimize.ts:140`                                           |
| `useWalkForwardStatus`    | `src/api/queries/walkforward.ts:113` (1000 ms until terminal)               |
| `useStrategySearchStatus` | `src/api/queries/strategySearch.ts:143`                                     |
| `useNeuralTrainingRun`    | `src/api/queries/neural.ts:110`, through `neuralTrainingRunRefetchInterval` |
| `useIngestStatus`         | `src/api/queries/storage.ts:62`                                             |
| `useDiscoveryAbRun`       | `src/api/queries/experiments.ts:58`                                         |
| `useEncoderAblationRun`   | `src/api/queries/experiments.ts:127`                                        |
| `useAlphaResearchRun`     | `src/api/queries/experiments.ts:159`                                        |

Each hook's query key comes from a per-domain key factory (`backtestKeys.jobStatus`,
`walkforwardKeys.status`, and so on), and each payload has its own REST shape
(Finding 5). Client state uses Zustand (`src/store/useAppStore.ts` with `slices/`).
The application header in `src/components/layout/AppShell.tsx` holds the logo,
`DigitalClock`, `MotionToggle`, `BrightnessToggle`, and `WindowControls`.

The vendored TypeScript contracts live in `contracts/` at the repository root,
pinned by `CONTRACTS_REV` at `998a505`, and are imported by relative path
(`import type { BacktestStatusResponse } from '../../../contracts/api'`).
`contracts/stream.ts` currently has only the Q-002 frames. MSW `^2.7` serves
offline mock data from `src/mocks/handlers.ts`, including simulated job
progression in `backtest.ts`, `walkforward.ts`, `experiments.ts`, and others.
Tests run under Vitest with Testing Library (`tests/unit/setup.ts`, `TZ=America/Sao_Paulo`),
and `scripts/ci.sh` runs install, contracts check, typecheck, lint, format check,
tests, and build. There is no WebSocket usage anywhere in `src/`. The gap: nine
hooks poll for what the backend now pushes.

## Interfaces produced

```ts
// src/lib/stream/framing.ts
export type InboundFrame =
  | { kind: 'subscribed'; frame: SubscribedFrame }
  | { kind: 'rejected'; frame: RejectedFrame }
  | { kind: 'lagging'; frame: LaggingFrame }
  | { kind: 'cursor_expired'; frame: CursorExpiredFrame }
  | { kind: 'epoch_changed'; frame: EpochChangedFrame }
  | { kind: 'entry'; envelope: StreamEnvelope }
export function parseTextFrame(data: string): InboundFrame // by `type`; throws StreamFrameError
```

```ts
// src/lib/stream/reconciler.ts   (pure; no I/O)
export type JobKey = `${JobKind}:${string}`
export interface ReconcilerState {
  /* phase, buffer, watermark, lastSeq per topic, epochs */
}
export type ReconcilerEffect =
  | { type: 'fetchSnapshot' }
  | { type: 'fetchHistory'; topic: 'jobs.terminal'; epoch: string; fromSeq: number }
  | { type: 'jobProgress'; key: JobKey; payload: JobProgressPayload }
  | { type: 'jobTerminal'; key: JobKey; payload: JobTerminalPayload }
  | {
      type: 'resync'
      reason: 'epoch_changed' | 'lagging' | 'cursor_expired' | 'history_expired' | 'rejected'
    }
export function initialState(): ReconcilerState
export function onSubscribed(
  s: ReconcilerState,
  f: SubscribedFrame,
): [ReconcilerState, ReconcilerEffect[]]
export function onEntry(
  s: ReconcilerState,
  e: StreamEnvelope,
): [ReconcilerState, ReconcilerEffect[]]
export function onSnapshot(
  s: ReconcilerState,
  snap: JobSnapshotResponse,
): [ReconcilerState, ReconcilerEffect[]]
export function onHistory(
  s: ReconcilerState,
  page: HistoryPage | HistoryExpired,
): [ReconcilerState, ReconcilerEffect[]]
export function onControl(
  s: ReconcilerState,
  f: InboundFrame,
): [ReconcilerState, ReconcilerEffect[]]
```

```ts
// src/lib/stream/client.ts
export type StreamStatus = 'disabled' | 'connecting' | 'live' | 'unavailable'
export interface StreamClientDeps {
  socketFactory: (url: string) => WebSocket
  fetchSnapshot: () => Promise<JobSnapshotResponse>
  fetchHistory: (
    topic: string,
    epoch: string,
    fromSeq: number,
  ) => Promise<HistoryPage | HistoryExpired>
  now: () => number
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (h: unknown) => void
}
export const MAX_BACKOFF_MS = 30_000
export class JobStreamClient {
  constructor(url: string, deps: StreamClientDeps)
  retain(): () => void // ref-counted open; returns release
  status(): StreamStatus
  onStatus(fn: (s: StreamStatus) => void): () => void
  onJobEvent(fn: (e: JobProgressEffect | JobTerminalEffect) => void): () => void
}
export function backoffDelay(attempt: number): number // 500 * 2^attempt, capped, full jitter
```

```ts
// src/lib/stream/jobQueryBridge.ts
export const JOB_STATUS_QUERY_KEYS: Record<JobKind, (jobId: string) => QueryKey>
export const PROGRESS_REFRESH_MIN_INTERVAL_MS = 1_000
export function connectJobStreamToQueryClient(
  client: JobStreamClient,
  queryClient: QueryClient,
): () => void
export function streamAwareRefetchInterval<T>(
  kind: JobKind,
  pollingInterval: (query: Query<T>) => number | false,
): (query: Query<T>) => number | false
```

```tsx
// src/lib/stream/JobStreamProvider.tsx
export function JobStreamProvider({ children }: { children: React.ReactNode }): JSX.Element
export function useJobStream(): JobStreamClient // retains while mounted
export function useStreamStatus(): StreamStatus

// src/components/layout/LiveUpdatesIndicator.tsx
export function LiveUpdatesIndicator(): JSX.Element | null // renders only when status === 'unavailable'
```

```
src/lib/env.ts        + enableStream: VITE_ENABLE_STREAM !== 'false' && !enableMsw
CONTRACTS_REV         → q_contracts commit carrying Q-009, the control-frame `type` discriminator (09400d7), and Q-015's recapture
contracts/            regenerated (stream.ts, topics.ts, api.ts)
```

## Implementation decisions

- **A text frame is classified by its `type` field alone: present means the
  control frame it names, absent means a stream envelope.** Server control frames
  carry `type` from `q_contracts` `09400d7` on, and envelopes never do. Inferring
  the kind from which other keys are present would break the first time two
  frames share a key, and `cursor_expired` and `lagging` already share `topic`.
  An unknown `type` throws `StreamFrameError` rather than falling through to
  `entry`, so a newer server frame is never processed as a job event.

- **Stream events invalidate the existing status queries. They do not write
  stream payloads into the query cache.** The nine views render nine different
  REST shapes, and the stream carries one normalized shape (Q-009). Writing it
  into the cache would mean nine hand-written translators from the stream shape
  back into REST shapes, which is exactly the mirror invariant 2 forbids, and
  every view would silently lose any field the stream omits. Invalidation fetches
  the real payload once, so the views stay byte-for-byte as before. The saving
  comes from not fetching when nothing has changed.

- **Progress entries trigger a leading-and-trailing throttled invalidation, at
  most once per second per job. Terminal events invalidate immediately.** Today's
  poll interval is one second, so this never refreshes more often than polling
  did. An optimization publishing ten progress entries a second does not become
  ten requests a second. The trailing call guarantees that the last progress
  entry is reflected.

- **`streamAwareRefetchInterval` wraps each hook's existing interval function,
  returning `false` while the stream status is `live` and the existing function's
  value otherwise.** That changes one line per hook and keeps each hook's
  terminal-state logic, so a job view still stops polling at a terminal state when
  the stream is down. A `refetchInterval` function is re-evaluated only after a
  fetch, so on the transition to `unavailable` the bridge calls
  `invalidateQueries` for every active job status key. That fetch re-evaluates the
  interval and polling resumes, which is what criterion 6's two-second bound relies
  on.

- **Status becomes `live` only after `onSnapshot` has applied a snapshot, never on
  socket open or on `subscribed`.** Between subscribe and snapshot, the client does
  not yet know which jobs have finished. If polling stopped at socket open, a job
  that finished during that window would be shown as running, with neither poll
  nor push to correct it. That is the gap the spec's "no moment when a view is
  neither polling nor live" requirement rules out.

- **The protocol logic is a pure reducer (`reconciler.ts`) that returns effects,
  and `client.ts` performs them.** §4.2's buffer, discard, gap, and resync rules
  are where correctness lives, and as a pure function of `(state, input)` they can
  be tested exhaustively and deterministically without sockets or timers. The
  client is then thin enough that its tests only need to check that effects are
  carried out.

- **Only `jobs.terminal` gaps are filled from history. `jobs.progress` gaps are
  ignored.** `jobs.progress` is ephemeral and coalesced (§4.4): a gap there is
  normal, and the next entry or the snapshot supersedes it. Fetching progress
  history would also fail, because Q-015 refuses history for ephemeral topics.

- **Buffered progress entries are discarded when their `seq` is at or below the
  snapshot item's `progress_seq` in the same epoch, and terminal entries when
  their `seq` is at or below `watermark["jobs.terminal"].seq`.** Q-015 provides
  exactly these two watermarks. An epoch that differs from the snapshot's marks the
  entry as belonging to a newer epoch, and the reducer requests a resync instead of
  guessing.

- **The client is ref-counted and opened by `useJobStream()` in each status hook,
  and a `JobStreamProvider` mounted in `src/app/providers.tsx` holds the single
  instance.** The spec requires at most one socket and none when no job view is
  mounted. A module-level singleton would make tests share a socket across cases,
  while a provider gives each test its own client with injected dependencies.

- **The WebSocket URL is derived from `env.apiBaseUrl` by swapping `http` for `ws`
  and appending `/api/v1/stream`.** A second environment variable for the same
  host would be a way for REST and the stream to point at different backends
  without anyone noticing.

- **Backoff is `min(30 s, 500 ms × 2^attempt)` with full jitter, reset after a
  snapshot is applied.** The 30-second cap is architecture §8.1's. Jitter keeps
  several windows of the Tauri app from reconnecting in lockstep after an API
  restart. Resetting on `live` rather than on `open` means a server that accepts
  and immediately fails keeps backing off instead of looping at 500 ms.

- **`enableStream` is false whenever `enableMsw` is true, and in that state
  status is `disabled`, not `unavailable`.** Mock mode has no backend stream. The
  indicator exists to report a failing live system, and showing it permanently
  in the mode the cloud-agent workflow in `AGENTS.md` relies on would train
  everyone to ignore it.

- **A test asserts that no `interface`/`type` named `*Frame`, `StreamEnvelope`,
  `JobProgressPayload`, `JobTerminalPayload`, `HistoryPage`, or `JobSnapshotResponse`
  is declared under `src/`.** These types must come from `contracts/`. A local
  redeclaration compiles fine and drifts silently the next time the contract
  gains a field.

- **`LiveUpdatesIndicator` sits in the header's right-hand group, before
  `MotionToggle`, and uses the existing surface and text tokens with no new
  styling primitives.** Architecture §8.1 names a "live updates unavailable" pill.
  The header is the only element visible on every workspace, and the spec forbids
  view changes beyond when updates happen.

## Ordered implementation

1. Create the branch `Q-016-job-progress-over-the-stream-spec` in `q_frontend`
   from `development`, after Q-014 and Q-015 are merged in `q_backend` and Q-015's
   `q_contracts` recapture is merged.
2. Set `CONTRACTS_REV` to that `q_contracts` commit. Run `make contracts` and
   `pnpm typecheck`, fixing only compile errors caused by regenerated API types.
   Confirm `make contracts-check` passes and the full test suite still passes.
   Commit.
3. Write failing tests in `tests/unit/lib/stream/framing.test.ts`: a `subscribed`
   JSON frame (`{"type": "subscribed", ...}`) parses to `{kind: 'subscribed'}`; a
   `jobs.terminal` envelope, which has no `type`, parses to `{kind: 'entry'}`; a
   frame with `type: "unknown"` and malformed JSON both throw `StreamFrameError`. Confirm they
   fail, implement, confirm they pass. Commit.
4. Write failing tests in `tests/unit/lib/stream/reconciler.test.ts`:
   - after `onSubscribed`, the effects are `[fetchSnapshot]`
   - entries terminal seq 4, 5, 6 and progress seq 10 for job A arrive before a
     snapshot with terminal watermark 5 and A's `progress_seq` 10; the effects
     after `onSnapshot` are exactly `jobTerminal` for seq 6
   - live terminal seq 7 then 9 gives `fetchHistory(fromSeq: 8)`, and 9 is not
     applied until `onHistory` supplies 8
   - a history-expired response gives `resync('history_expired')`
   - `epoch_changed`, `lagging` for `jobs.terminal`, `cursor_expired`, and
     `rejected{stream_unavailable}` each give `resync` with the matching reason
   - a terminal entry already applied (duplicate seq) gives no effect
   - a progress gap gives no `fetchHistory`
     Confirm they fail, implement the reducer, confirm they pass. Commit.
5. Write failing tests in `tests/unit/lib/stream/client.test.ts` with a fake
   socket and fake timers:
   - `retain()` opens one socket, and a second `retain()` opens none
   - releasing both closes it
   - the subscribe frame is sent before `fetchSnapshot` is called
   - status is `connecting` until the snapshot resolves, then `live`
   - closing the socket sets `unavailable`, and reconnect delays for attempts 0 to
     8 are each ≤ 30,000 ms, with attempt 6 onward capped
   - a `resync` effect re-sends subscribe and re-fetches the snapshot
     Confirm they fail, implement, confirm they pass. Commit.
6. Write failing tests in `tests/unit/lib/stream/jobQueryBridge.test.ts` with a real
   `QueryClient`:
   - a `jobTerminal` effect for `backtest:r1` invalidates
     `backtestKeys.jobStatus('r1')` once
   - twenty `jobProgress` effects over 500 ms cause at most one invalidation
     before 1 s and exactly one trailing invalidation
   - `streamAwareRefetchInterval('backtest', () => 1000)` returns `false` while
     live and `1000` while unavailable
   - the transition to `unavailable` invalidates all nine kinds' active status
     queries
   - `JOB_STATUS_QUERY_KEYS` has nine entries. Exhaustiveness is enforced at
     compile time by typing it `Record<JobKind, ...>` over the generated union,
     so `pnpm typecheck` fails if Q-009's kind enum gains a member the bridge
     does not map
     Confirm they fail, implement, confirm they pass. Commit.
7. Add `JobStreamProvider`, `useJobStream`, and `useStreamStatus`, and mount the
   provider in `src/app/providers.tsx`. Add `enableStream` to `env.ts`. Write
   failing tests: with `enableMsw` true, status is `disabled` and no socket is
   created; mounting two components that call `useJobStream` creates one socket,
   and unmounting both closes it. Confirm they fail, implement, confirm they pass.
   Commit.
8. Wrap the nine hooks' `refetchInterval` with `streamAwareRefetchInterval`, and
   call `useJobStream()` in each. Write a failing parametrized test,
   `tests/unit/api/jobStatusStream.test.ts`, over the nine hooks with MSW REST
   handlers and a fake stream: while live and quiet for 5 s, zero status requests;
   after a terminal event, exactly one; after the socket closes, a status request
   within 2 s and then at the hook's pre-task interval. Confirm it fails, wire it
   in, confirm it passes. Run the full existing suite and confirm that no existing
   test needed changes beyond wrapping renders in `JobStreamProvider` through
   `tests/unit/testUtils.tsx`. Commit.
9. Write a failing test for criterion 7: with a fake REST whose snapshot promise
   is held open after reconnect, status requests continue at the polling interval
   until the promise resolves, and stop after. Confirm it passes with the
   `live`-after-snapshot rule and fails if status is set on `open`, verified by
   temporarily changing it. Commit.
10. Add `LiveUpdatesIndicator` to `AppShell`. Write failing tests: it renders the
    text "Live updates unavailable" when status is `unavailable`, and renders
    nothing for `live`, `connecting`, or `disabled`. Confirm they fail, implement,
    confirm they pass. Commit.
11. Write the failing test for criterion 10, which scans `src/**/*.ts{,x}` for
    declarations named in the decision above. Confirm it fails against a
    deliberately added local `interface SubscribedFrame` and passes after that is
    removed. Commit.
12. Human step, matching human-verifiable criterion 1: run `pnpm dev` with
    `VITE_ENABLE_MSW=false` against a local backend (API, worker, relay). Start a
    backtest and an optimization, watch the network panel for status requests,
    and compare each view's completion time with the terminal entry's appearance
    in `redis-cli XRANGE q:stream:jobs.terminal`.
13. Human step, matching human-verifiable criterion 2: during an optimization,
    stop Redis with `podman compose -f ../q_backend/docker-compose.yml stop redis`, confirm the indicator appears and status polling
    resumes within 2 s, start Redis, and confirm the indicator clears and the final
    state is correct.
14. Human step, matching human-verifiable criterion 3: repeat steps 12 and 13 in
    `pnpm tauri:dev`.
15. Human step, matching human-verifiable criterion 4: run one 200-trial
    optimization on the pre-task commit and on this branch, and record the count of
    `/api/v1/optimize/*` status requests from the network panel for each.
16. Run `scripts/ci.sh`. Commit.
17. Update the `q_frontend` row in `q_contracts/COMPAT.md` with this branch's
    merged commit, the pinned contracts commit, and the step 16 results. Commit
    in `q_contracts` on `development`.

## Validation

- **Unit:** frame parsing; reconciler buffer, discard, gap, duplicate, and resync
  rules; client ref-counting, ordering, status transitions, and backoff cap;
  bridge throttling, interval wrapping, and kind coverage; indicator rendering; no
  local stream type declarations.
- **Integration:** nine hooks under MSW REST with a fake stream: no polling while
  live, one refresh per terminal event, polling resumes within 2 s of loss and
  stops only after the snapshot is applied; mock mode opens no socket.
- **Regression:** the full existing Vitest suite passes, changed only by the shared
  provider wrapper; `make contracts-check` is clean; typecheck, lint, format, and
  build pass.
- **Manual:** steps 12 to 14.
- **Measurement:** status request count for one 200-trial optimization, before and
  after.
- **Pins:** `CONTRACTS_REV` changed, so the `q_frontend` row in
  `q_contracts/COMPAT.md` is updated (step 17).

```bash
cd /home/gui/projects/q/q_frontend
make contracts-check
TZ=America/Sao_Paulo pnpm test:run tests/unit/lib/stream tests/unit/api/jobStatusStream.test.ts
scripts/ci.sh

# human steps, against a local backend
VITE_ENABLE_MSW=false pnpm dev
pnpm tauri:dev
```

## Handoff

Report the `CONTRACTS_REV` commit and the clean drift check. Report the reconciler
test cases and their pass state. Report, for each of the nine hooks, the status
request counts from the parametrized test in the live-quiet, terminal, and
socket-closed phases. Report the manual measurements: time from terminal entry to
view completion for the backtest and the optimization, time for the indicator to
appear and polling to resume after Redis stops, and time to clear after Redis
starts. Report status request counts for the 200-trial optimization before and
after. State whether the Tauri shell behaved identically, and describe any
WebKitGTK difference plainly. Report every existing test file that changed and
why.
