# WO170 — Backend: execution worker, risk, recovery, and performance

## Shared context (read first)

Read `docs/design/paper-live-execution.md` and WO167–WO169 completion contracts. This WO joins the
durable domain, evaluator, and paper broker into the only process authorized to execute decisions.

Backend repo: `q_backend`, Python managed with `uv`.

## Files to read

- WO167–WO169 completion messages
- `src/q_backend/tasks/worker_context.py`
- `src/q_backend/tasks/broker.py`
- `src/q_backend/api/lifespan.py`
- `src/q_backend/market_data/service.py`
- `src/q_backend/storage/settings.py`
- `pyproject.toml`

## Goal

Run paper deployments continuously with a serialized MT5 owner, hard pre-trade risk gates, database
leases, crash-safe order intent, restart recovery, and measured M15/H1 latency.

## Tasks

1. Create `src/q_backend/execution/risk.py` with structured checks for global kill switch, lifecycle,
   lease ownership, bar/quote freshness, symbol/session status, quantity/notional, one-position rule,
   account equity/buying power, and maximum daily realized loss.
2. Create `src/q_backend/execution/service.py` to process one completed-bar decision:
   - persist/deduplicate the decision;
   - risk-check and record rejection or order intent;
   - commit the intent before broker submission;
   - submit through the configured broker;
   - atomically apply fill/ledger/position state;
   - mark ambiguous outcomes `unknown` for reconciliation, never automatic resend.
3. Create `src/q_backend/execution/worker.py` with database deployment leases, heartbeat, bounded
   polling aligned to timeframe boundaries, per-symbol/timeframe bar sharing, and graceful shutdown.
4. Implement start, pause, stop, flatten, and global kill-switch command semantics exactly as the
   design defines. Stop/pause never silently flatten.
5. Add startup recovery for expired leases, incomplete intents, unknown orders, open positions, and
   evaluator state. Recovery must fail closed when persistence or quote state is unavailable.
6. Add `src/q_backend/cli/q_execution.py`, a `q-execution` project script, settings for timing/risk
   defaults, and documented process launch. Do not run the worker inside API lifespan or Dramatiq.
7. Emit structured timings for bar detection, evaluation, risk, quote/broker, persistence, and total
   path. Add a reproducible benchmark harness and p50/p95 report.

## Guardrails

- Exactly one serialized owner performs MT5 calls and broker submissions.
- REST, Redis, frontend, and Dramatiq are absent from the order hot path.
- No order is submitted if its intent commit failed.
- Lease loss, stale data, database failure, or unknown prior outcome blocks new submission.
- The emergency flatten path still requires a fresh quote and durable intent; it bypasses strategy
  signals but not identity, lease, or persistence safety.
- Scope is market orders and M15-or-slower closed bars.

## Tests

- End-to-end fake-clock paper deployment processes a completed bar into one durable fill.
- Duplicate polling, worker restart, and lease takeover never duplicate a decision/order.
- Inject crashes before intent commit, after intent commit, during broker response, and before fill
  commit; assert the defined recovery/unknown state for each window.
- Every risk rule records a structured rejection and leaves ledger/position unchanged.
- Pause/stop retain positions; flatten closes explicitly; kill switch blocks entries across accounts.
- Database/MT5/quote failures fail closed and surface health detail.
- Benchmark representative CCM$ H1, WIN$ H1, and WDO$ M15 deployments; enforce p95 under 500 ms from
  completed-bar visibility to committed paper fill on the documented target profile.
- Run targeted execution tests and full `uv run pytest`.

## Docs

Add worker launch/configuration and performance procedure to `q_backend/README.md`. Paste measured
phase timings and lifecycle command contract for WO171/WO173.

## Definition of done

A standalone worker can safely run and recover paper deployments while meeting the measured
closed-bar latency budget without duplicate execution.

## Out of scope

REST/frontend, MT5 live submission, pending orders, hedging, portfolios, and sub-second execution.
