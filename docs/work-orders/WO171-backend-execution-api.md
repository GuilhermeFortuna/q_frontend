# WO171 — Backend: execution API and operator controls

## Shared context (read first)

Read `docs/design/paper-live-execution.md` and WO167/WO170 completion contracts. Request handlers are
control-plane only; the execution worker remains the sole order owner.

Backend repo: `q_backend`, Python managed with `uv`.

## Files to read

- WO167 and WO170 completion messages
- `src/q_backend/api/main.py`
- `src/q_backend/api/dependencies.py`
- `src/q_backend/api/routers/backtest.py`
- `src/q_backend/api/schemas/backtest.py`
- `src/q_backend/storage/db/execution_repositories.py`
- API persistence tests under `tests/api/`

## Goal

Expose paper accounts, immutable deployments, health, decisions/orders/fills/positions, and explicit
lifecycle/risk controls without executing broker operations in an HTTP request.

## Tasks

1. Add `src/q_backend/api/schemas/execution.py` with additive request/response models and explicit
   Decimal serialization for money/price/quantity.
2. Add `src/q_backend/api/routers/execution.py` with:
   - `POST/GET /api/v1/execution/accounts`;
   - `POST/GET /api/v1/execution/deployments`;
   - `GET /api/v1/execution/deployments/{id}`;
   - `POST /api/v1/execution/deployments/{id}/actions` for start/pause/stop/flatten;
   - paginated decisions, orders, fills, positions, ledger, and risk events;
   - `GET /api/v1/execution/health`;
   - `GET/PUT /api/v1/execution/kill-switch` with explicit confirmation input.
3. Validate that deployments reference an immutable saved strategy/config identity, one symbol and
   timeframe, `paper` mode, supported M15-or-slower timeframe, and bounded sizing/risk values.
4. Have mutations write desired control state/commands only. Return accepted/current state and let the
   worker acknowledge transitions asynchronously.
5. Return worker heartbeat, market-data freshness, last completed bar, last decision, unresolved
   unknown orders, and locked live capability separately.
6. Add pagination/filtering by account, deployment, status, symbol, and time range; never return
   unbounded audit history.

## Guardrails

- No broker, evaluator, or MT5 call in route handlers.
- `live` deployment creation/activation is rejected while live capability is locked.
- Flatten and kill-switch changes require explicit confirmation and produce audit events.
- API availability is not execution-worker health; expose both states honestly.
- Do not put credentials or MT5 passwords in request/response/database JSON.
- Existing endpoints remain byte-compatible.

## Tests

- Route/schema tests for account/deployment creation and every legal/illegal action.
- Immutable strategy reference, timeframe, risk bounds, Decimal, and live-locked validation.
- Pagination/filter tests and old/empty-state behavior.
- Flatten/kill-switch confirmation and audit tests.
- API-up/worker-down and worker-up/market-data-stale health fixtures.
- Postgres unavailable returns a clear failure and cannot imply that a command was accepted.
- OpenAPI smoke plus full `uv run pytest`.

## Docs

Update the backend endpoint inventory and paste complete account, deployment-detail, action, health,
and kill-switch JSON contracts for WO173/WO174.

## Definition of done

Operators and the frontend can fully control and inspect paper execution through bounded, honest APIs
without creating a second order-execution owner.

## Out of scope

Worker implementation, live MT5 submission, WebSockets, frontend, and strategy authoring.
