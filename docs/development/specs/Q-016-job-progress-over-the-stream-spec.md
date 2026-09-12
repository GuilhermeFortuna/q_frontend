# Q-016: Job progress over the stream

**Status:** authoritative in the [Q project board](https://github.com/users/GuilhermeFortuna/projects/2)  
**Project direction:** [`q_contracts/docs/system-architecture.md` §4.2, §8.1, §10 phase 1](https://github.com/GuilhermeFortuna/q_contracts/blob/d71ad64f11e7129549fa5ec8515875bdcec74cb0/docs/system-architecture.md#81-degraded-behavior)  
**Depends on:** Q-014, Q-015  
**Implementation plan:** [`../plans/Q-016-job-progress-over-the-stream-plan.md`](../plans/Q-016-job-progress-over-the-stream-plan.md)

## Purpose

The research UI learns that a backtest, optimization, walk-forward, search,
training run, ingest, or experiment has progressed or finished by polling its
status endpoint every second for as long as the job runs. Nine such hooks poll
independently. A finished job is noticed up to a second late, and a running job
costs a request per second per view even when nothing changes. After Q-012 to
Q-015, the backend publishes every job's progress and terminal outcome on the
stream and serves a race-free snapshot. This task makes the research UI consume
them. It uses architecture §4.2's subscribe, snapshot, and reconcile protocol,
through one client shared by every job view. Polling stays as the degraded path
§8.1 prescribes, with a visible indication that live updates are unavailable.
It is the first consumer of the stream protocol, so it is also where the protocol
is proven end to end from a user's point of view.

## Requirements

### One stream client

- The research UI keeps at most one stream connection, shared by every view that
  shows job state, and opens it only while at least one such view is mounted.
- On every connection, including reconnections, the client subscribes before it
  fetches the job snapshot, buffers stream entries until the snapshot is applied,
  discards buffered entries that the snapshot already reflects, and applies the
  rest in sequence order.
- A terminal event that arrives in sequence with no gap is applied. A gap in the
  terminal topic is filled from history before later events are applied. An
  expired history range, an epoch change, a lagging notice on the terminal topic,
  or a rejection causes a fresh snapshot.
- Reconnection uses exponential backoff capped at thirty seconds, and every
  reconnection re-runs the snapshot protocol.
- Nothing in the client assumes every progress entry is delivered. Everything in
  it assumes every terminal event is delivered exactly once, in order, or
  explicitly declared missing.

### Job views

- While the stream is live, job status views do not poll. A progress entry for a
  job causes that job's view to refresh at most once per second. A terminal event
  causes it to refresh immediately.
- Every job view shows the same information, in the same place, with the same
  components, as before this task. The difference is when it updates, not what it
  shows.
- A job finishing is reflected in its view within one second of the terminal
  event being published, where before it could take up to the poll interval plus
  the request time.

### Degraded behavior

- When the stream is unavailable — refused at connect, closed, rejected as
  unavailable, or not yet reconnected — every mounted job view resumes polling at
  its pre-task interval within two seconds, and a "live updates unavailable"
  indicator is visible in the application shell.
- When the stream becomes live again, the indicator clears and polling stops
  after the fresh snapshot has been applied, not before, so there is no moment
  when a view is neither polling nor live.
- In offline mock mode, the stream is disabled rather than failing, polling is
  used, and the unavailable indicator is not shown.

### Contracts

- The vendored contracts are pinned to the commit that includes Q-009's schemas
  and Q-015's recaptured OpenAPI. Every stream frame, job event, snapshot, and
  history type the client uses comes from the vendored types. None are written by
  hand.

### Preserved behavior

- The existing unit test suite passes without modifying any existing test,
  except to supply the stream client that views now depend on.
- Surfaces that poll for reasons other than job status — market data, execution,
  news, features, system health — are unchanged.

## Constraints and non-goals

- **No change to REST job payloads or view components.** Stream job events carry
  a normalized, minimal payload, and the views render the existing REST
  payloads. Rewriting the views to render the stream payload directly is the
  change that would let those REST shapes be cleaned up, and it is a later task.
- **No market-data or execution streaming.** Quotes and bars on the stream serve
  the terminal. The research UI's market-data polling and the execution
  workspace, which is removed in phase 4, are untouched.
- **No Arrow decoding in the research UI.** Job topics are JSON control payloads,
  and adding an Arrow dependency for a frame type this client never subscribes to
  is weight without use. Binary frames received unexpectedly are ignored and
  logged.
- **No mock stream.** Offline mock mode keeps simulating job progress over
  REST, as it does today. Duplicating job simulation into a WebSocket mock would
  mean two mock implementations to keep consistent.
- **No change to the Tauri shell's process management.** The shell's spawning
  of backend services is removed in Batch 03.

## Acceptance criteria

### Agent-verifiable

1. With a fake socket and fake REST, the client subscribes before requesting the
   snapshot, and entries delivered between the two are buffered and applied after
   it, with entries at or below the watermark discarded.
2. A terminal event with a sequence gap triggers a history request for exactly
   the missing range before later events are applied.
3. An expired history response, an epoch-changed notice, a lagging notice on the
   terminal topic, and a stream-unavailable rejection each trigger a fresh
   snapshot.
4. Reconnect delays grow exponentially and never exceed thirty seconds.
5. For each of the nine job status hooks, no status request is made while the
   stream is live and nothing is published. One request follows a terminal event
   for that job. At most one request per second follows a burst of progress
   entries.
6. When the socket closes, each mounted job status hook issues a status request
   within two seconds and continues at its pre-task interval. The unavailable
   indicator renders.
7. After reconnection, polling stops only once the new snapshot has been applied,
   verified by ordering assertions on the fake REST calls.
8. With mock mode enabled, no socket is opened, hooks poll, and the indicator does
   not render.
9. Only one socket exists while two different job views are mounted, and none
   after both unmount.
10. Stream types are imported from the vendored contracts, and a test fails if a
    stream frame interface is declared under the source tree.
11. `CONTRACTS_REV` points at the required commit, and the contracts drift check
    passes.
12. The full validation suite passes.

### Human-verifiable

1. Against the real backend with the relay running, a backtest and an
   optimization are started from the research UI. The network panel shows no
   status polling while they run, and each view shows completion within a second
   of the terminal event appearing on the stream.
   Command: `pnpm dev`, then in `q_backend`: `uv run dev`, `uv run worker`, `uv run q-outbox-relay`
2. Stopping Redis while an optimization runs shows the unavailable indicator and
   resumed polling within two seconds. Starting Redis clears the indicator, and
   the job's final state is shown correctly.
   Command: `podman compose -f ../q_backend/docker-compose.yml stop redis` then `podman compose -f ../q_backend/docker-compose.yml start redis`
3. The same flows behave identically inside the Tauri desktop shell on
   WebKitGTK.
   Command: `pnpm tauri:dev`
4. Request counts for one optimization of a fixed size are compared before and
   after the change, from the browser network panel, and reported.
   Command: `pnpm dev` on the pre-task commit and on this branch
