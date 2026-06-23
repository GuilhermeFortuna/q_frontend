# WO103 — Frontend: make backtest performance worker responses request-safe

## Shared context (read first)

Frontend-only WO. Use `pnpm`, never `npm`.

Depends on **WO100**.

**Review finding:** `computeBacktestPerformance` reuses a shared Worker but every request listens for
the next `message` without a request id. Overlapping large backtest computations can resolve with
the wrong payload, showing stale equity/monthly data under the latest run.

## Goal

Make the backtest performance worker safe under overlapping requests:

- each worker response maps to exactly one request;
- stale worker responses cannot update the latest run;
- worker failure still falls back to main-thread computation;
- tests prove concurrent calls do not cross-resolve.

## How the pieces work today

Read:

- `src/lib/workers/backtestPerformanceClient.ts`
- `src/lib/workers/backtestPerformance.worker.ts`
- `src/lib/backtesting/useBacktestPerformanceData.ts`
- `src/workspaces/backtests/BacktestsWorkspace.tsx`
- `src/lib/backtesting/performance.ts`
- `tests/unit/lib/workers/backtestPerformanceClient.test.ts`

## Tasks

### 1. Add request identity to worker messages

Introduce request/response envelopes:

- request: `{ requestId, trades, initialCapital }`
- response: `{ requestId, payload }`
- error path: `{ requestId, error }` or fallback through `error` event handling.

Use a monotonically increasing id or another stable per-call id.

### 2. Track pending requests explicitly

In `backtestPerformanceClient.ts`:

- keep a `Map<requestId, { resolve, reject/fallback, trades, initialCapital }>`;
- install one shared `message` listener per Worker instance;
- resolve only the matching pending request;
- cleanup pending entries after resolve/fallback;
- terminate/reset cleanly in `terminateBacktestPerformanceWorker`.

Avoid attaching one `message` listener per request unless the listener filters by request id.

### 3. Guard the React hook from stale async commits

Keep the existing cancellation guard in `useBacktestPerformanceData`, but also ensure a late response
from an older trade list cannot commit over the latest one.

Use request identity, an effect-local sequence number, or both.

### 4. Add concurrent-request tests

Extend `tests/unit/lib/workers/backtestPerformanceClient.test.ts` with a fake Worker that:

- captures posted messages;
- returns responses out of order;
- asserts each `computeBacktestPerformance` promise receives its matching payload;
- verifies fallback still works when Worker is unavailable.

Add a hook-level test if practical for stale response suppression.

## Visual guardrails

> Result visuals must not change. This WO fixes data correctness behind existing charts/tables.

## Tests

- `pnpm test:run -- tests/unit/lib/workers/backtestPerformanceClient.test.ts`
- `pnpm test:run -- tests/unit/components/BacktestFocusWorkbench.test.tsx tests/unit/workspaces/BacktestsWorkspace.test.tsx`
- `pnpm test:run`
- `pnpm exec tsc -p tsconfig.app.json --noEmit`
- `pnpm build`

## Manual verification

Using a large mocked or real trade list:

- start one large backtest, then trigger another before the first derived series finishes;
- verify equity curve, drawdown chart, monthly table, and export all match the latest run;
- verify no stale “Computing performance series…” state remains.

## Definition of done

- Worker protocol has request/response correlation.
- Concurrent worker tests fail on the old implementation and pass on the new implementation.
- Stale responses cannot update the latest visible run.
- Required test/typecheck/build commands pass.

## Out of scope

- Backend job execution.
- Changing backtest response payloads.
- Replacing the chart renderer.
