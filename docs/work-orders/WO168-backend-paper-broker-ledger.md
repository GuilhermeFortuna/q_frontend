# WO168 — Backend: broker contract and internal paper simulator

## Shared context (read first)

Read `docs/design/paper-live-execution.md` and WO167's completion contract. This WO implements the
broker abstraction and deterministic internal paper fills. It does not schedule strategies.

Backend repo: `q_backend`, Python managed with `uv`.

## Files to read

- WO167 completion message
- `src/q_backend/market_data/clients/metatrader.py`
- `src/q_backend/backtesting/costs.py`
- `src/q_backend/backtesting/tick/orders.py`
- `src/q_backend/storage/db/execution_repositories.py`
- `tests/market_data/conftest.py`

## Goal

Provide a small broker-neutral interface and a paper implementation that uses fresh MT5 bid/ask
quotes, updates a durable account ledger, and can later be replaced by MT5 live submission without
changing strategy or risk code.

## Tasks

1. Create `src/q_backend/execution/brokers/base.py` with typed broker health, account, quote, order,
   fill, position, and reconciliation contracts. Use an injectable clock and quote source.
2. Create `src/q_backend/execution/brokers/paper.py` for market orders only:
   - buy/short-cover at ask;
   - sell/short-entry at bid;
   - deterministic configured slippage and commission;
   - full fill or explicit rejection.
3. Create `src/q_backend/execution/ledger.py` to atomically apply fills to cash, realized P&L, fees,
   and the single net position. Support long, short, close, and close-then-reverse as explicit orders.
4. Reject missing/stale/non-positive/crossed quotes and invalid quantity before mutation.
5. Return structured rejection codes and retain quote timestamp, raw bid/ask, adjusted fill price,
   fee, and model configuration on every fill.
6. Add account snapshot/mark-to-market behavior using executable-side quotes without persisting ticks.

## Guardrails

- This is an internal simulator; never call `order_check()` or `order_send()`.
- Do not fabricate partial fills or market depth.
- Do not silently fill from bar close/open when a fresh executable quote is unavailable.
- Keep paper and future live implementations behind the same domain interface; do not leak MT5
  constants into strategy/risk code.
- All ledger/position/fill changes are one database transaction.
- Do not add latency randomness; simulations and tests must be reproducible.

## Tests

- Long/short open, close, and explicit reversal accounting.
- Non-zero spread round trip loses the spread; slippage and commission apply exactly once per side.
- Ledger conservation across cash, realized P&L, unrealized P&L, equity, and fees.
- Duplicate fill identity is idempotent.
- Stale/invalid quote and invalid quantity reject without any ledger mutation.
- Broker contract tests are reusable by WO172.
- Run targeted execution/storage tests, then full `uv run pytest`.

## Docs

Paste the final broker protocol and one complete paper fill/account snapshot contract for WO170/WO171.

## Definition of done

Q can deterministically execute and account for a broker-neutral market order against live quote
shapes without sending anything to MT5.

## Out of scope

Scheduling, strategy signals, risk limits beyond request validation, pending/partial orders, API,
frontend, and MT5 live trading.
