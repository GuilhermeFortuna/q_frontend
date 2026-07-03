# WO178 — Backend: unknown-order reconciliation

## Shared context (read first)

This is part of the WO177–WO182 hardening batch: no new features, only closing correctness and
safety gaps in paths that already exist. Read `docs/design/paper-live-execution.md` and the
WO167–WO172 completion contracts.

Backend repo: `q_backend`, Python managed with `uv` (`uv run pytest` — never pip/poetry).

## Files to read

- `src/q_backend/execution/service.py` (order submission; the `except Exception` handler near line
  476 that transitions a fill-persistence failure to `ExecutionOrderStatus.UNKNOWN` with
  `ReconciliationState.PENDING`)
- `src/q_backend/execution/recovery.py` and `src/q_backend/storage/db/execution_repositories.py`
  (`mark_incomplete_orders_unknown`, the `ReconciliationState.PENDING` writers near lines 656/665)
- `src/q_backend/execution/brokers/base.py`, `brokers/paper.py`, `brokers/metatrader.py`
- `src/q_backend/api/routers/execution.py`
- `tests/execution/test_service.py` (`test_crash_windows_leave_expected_recovery_state`)

## Problem (found in audit, 2026-07-02)

Orders are correctly marked `UNKNOWN` / `ReconciliationState.PENDING` when a crash window or fill
persistence failure makes their outcome ambiguous — but nothing in the codebase ever _reads_
`ReconciliationState.PENDING`. There is no reconciler, no API surface, and no operator path. An
unknown order is a dead end: ledger and position state silently diverge from the broker forever.

## Goal

Every `UNKNOWN` order is eventually resolved — automatically when the broker can answer, explicitly
by an operator when it cannot — and unresolved unknowns are loudly visible and block new submissions
for the affected deployment.

## Tasks

1. Add a broker capability to `brokers/base.py`: `lookup_order(client_order_id) -> BrokerOrderState`
   returning filled (with fill details), rejected, not-found, or unavailable. Implement it for the
   paper broker (authoritative from its own ledger) and MT5 broker (history/deal lookup by client
   order id). `fakes.py` gains a configurable implementation for tests.
2. Create `src/q_backend/execution/reconciliation.py`: given a session and broker, list orders with
   `ReconciliationState.PENDING`, look each up, and resolve:
   - broker confirms fill → apply the same atomic fill/ledger/position transition the happy path
     uses (reuse the service logic, do not duplicate it);
   - broker confirms rejection/not-found → mark order failed, release the intent, leave ledger
     untouched;
   - broker unavailable → leave `PENDING`, record last-attempt timestamp and error.
3. Production trigger (cutover guardrail — this must actually run): call reconciliation from the
   execution worker's startup recovery (after `ExecutionRecovery` marks unknowns) and on every
   worker poll cycle while any `PENDING` order exists for a leased deployment.
4. A deployment with an unresolved `PENDING` order must not submit new orders — add this as a
   structured risk-gate rejection in `execution/risk.py`, not an ad-hoc check.
5. Extend the execution API (`routers/execution.py`): unresolved-unknown count in deployment/health
   payloads, list endpoint for pending-reconciliation orders, and a manual-resolve endpoint
   (operator asserts filled-with-details or not-filled; record who/when/why in the order row).

## Guardrails

> Reconciliation never re-submits an order. Resolution is read-and-record only; the "resend"
> decision stays with the strategy on later bars.
> The manual-resolve endpoint requires an explicit outcome payload; there is no "assume it's fine"
> default.
> Fail closed: if reconciliation cannot reach the broker, the deployment stays blocked. No time-based
> auto-expiry of unknowns.

## Tests

`tests/execution/test_reconciliation.py`:

- unknown order + broker says filled → ledger/position match a never-crashed run (parity with the
  happy-path fixture in `test_service.py`);
- unknown order + broker says not-found → order failed, ledger unchanged, deployment unblocked;
- broker unavailable → stays pending, deployment stays blocked, new submissions risk-rejected with
  the structured reason;
- manual resolution endpoint round-trip through the API (`tests/api`);
- worker restart with a pending unknown reconciles before the first new decision is processed
  (extend `tests/execution/test_worker.py`).

## Docs

Add an "Unknown orders and reconciliation" section to `docs/design/paper-live-execution.md`
describing the state machine (`UNKNOWN` → resolved/failed, who may transition, and the blocking
rule).

## Definition of done

`uv run pytest` passes — do not report completion until it does. Final message must include: the
reconciliation state machine as implemented, the production trigger points (exact call sites in the
worker), and the new API routes.

## Out of scope

New broker features, pending/limit orders, portfolio-level reconciliation, and the frontend surface
for the manual-resolve flow (backlog; the API contract from this WO is its input). Baseline test
fixes are WO177; exception-policy sweep is WO179.
