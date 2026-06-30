# WO167 — Backend: execution domain and durable state

## Shared context (read first)

Read `docs/design/paper-live-execution.md`. This is the foundation for WO168–WO174. It defines the
broker-neutral state and persistence invariants only; it does not run strategies or fill orders.

Backend repo: `q_backend`, Python managed with `uv`.

## Files to read

- `src/q_backend/backtesting/models.py`
- `src/q_backend/storage/db/models.py`
- `src/q_backend/storage/db/repositories.py`
- `src/q_backend/storage/db/base.py`
- `src/q_backend/storage/db/engine.py`
- `alembic/versions/`
- `tests/storage/`

## Goal

Add a broker-neutral execution domain and normalized Postgres state that can represent internal paper
trading now and MT5 orders later without using backtest `Order`/`Trade` objects as durable live state.

## Tasks

1. Create `src/q_backend/execution/domain.py` with typed enums/models for broker mode, deployment
   lifecycle, decision outcome, side, order status, position side, fill, risk rejection, and external
   reconciliation state. Keep domain names independent of MT5 constants.
2. Add SQLAlchemy models for paper accounts, deployments, decisions, execution orders, fills, net
   positions, ledger entries, risk events, worker leases, and singleton execution-control state.
3. Add the Alembic migration with indexes and uniqueness constraints for:
   - `(deployment_id, bar_close_time)` decision idempotency;
   - broker/external fill identity;
   - one open net position per deployment;
   - one current lease per deployment.
4. Add focused repositories in `src/q_backend/storage/db/execution_repositories.py`. Mutation methods
   must accept an existing session so the worker can atomically commit intent/ledger/position changes.
5. Define legal lifecycle transitions and reject illegal transitions in the domain/service boundary.
6. Store immutable strategy/config identity on every deployment and decision: strategy name/version,
   compiled config, config hash, symbol, timeframe, and sizing/risk config.

## Guardrails

- Do not reuse ephemeral backtest registry objects as execution persistence.
- Do not store bars or ticks in Postgres.
- Execution persistence is not best-effort: a failed commit means no order may be sent.
- Use `Decimal`-safe persisted numeric types for money, quantity, price, and fees; do not persist
  binary floating-point account balances.
- Migrations are additive and must not alter existing backtest/research tables.
- Do not add API routes, MT5 calls, scheduling, or frontend code.

## Tests

- Legal/illegal lifecycle transition tests.
- Unique decision, fill, lease, and open-position constraint tests.
- Repository transaction rollback tests prove partial ledger/position writes cannot survive.
- Decimal round-trip tests cover B3-style prices and quantities.
- Migration upgrade/downgrade smoke plus full `uv run pytest`.

## Docs

Paste the final domain enums, table names, and repository transaction boundaries in the completion
message for WO168–WO171.

## Definition of done

Q has durable, broker-neutral execution state with database-enforced idempotency and accounting
boundaries, while every existing backtest/research path remains unchanged.

## Out of scope

Broker implementations, strategy evaluation, worker loops, REST, frontend, and live activation.
