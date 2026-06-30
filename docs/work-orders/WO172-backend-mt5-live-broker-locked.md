# WO172 — Backend: locked MT5 live broker adapter

## Shared context (read first)

Read `docs/design/paper-live-execution.md`, the official MT5 Python documentation, and WO168/WO170
completion contracts. No demo/controlled trading account is available. Implement and test the adapter,
but keep submission locked and do not claim production readiness.

Backend repo: `q_backend`, Python managed with `uv`.

## Files to read

- WO168 and WO170 completion messages
- `src/q_backend/execution/brokers/base.py`
- `src/q_backend/execution/service.py`
- `src/q_backend/market_data/clients/metatrader.py`
- `src/q_backend/storage/settings.py`
- `docker/metatrader5-stub/`
- [MT5 Python integration](https://www.mql5.com/en/docs/python_metatrader5)
- [`order_check()`](https://www.mql5.com/en/docs/python_metatrader5/mt5ordercheck_py)
- [`order_send()`](https://www.mql5.com/en/docs/python_metatrader5/mt5ordersend_py)

## Goal

Translate broker-neutral market orders into auditable MT5 requests and reconcile their real outcome,
while making accidental activation impossible in the current environment.

## Tasks

1. Create `src/q_backend/execution/brokers/metatrader.py` implementing the WO168 broker contract on
   the execution worker's serialized MT5 owner thread.
2. Preflight terminal/account connectivity and trading permissions, exact account allowlist, symbol
   visibility, quote freshness, execution mode, price digits, volume min/max/step, stops constraints,
   and supported fill/time policy.
3. Translate domain market orders and explicit position closes. Carry Q's stable intent identity in
   magic/comment within MT5 limits and retain the complete normalized/raw request.
4. Run `order_check()` before `order_send()`. Map validation and trade retcodes to structured domain
   results without treating a successful check or accepted request as a confirmed fill.
5. Reconcile through `orders_get()`, `positions_get()`, `history_orders_get()`, and
   `history_deals_get()`. Persist external order/deal/position tickets and deduplicate deals.
6. Treat timeouts/process crashes/ambiguous responses as `unknown`; search by stored tickets and
   intent metadata before any terminal decision. Never automatically resend an unknown intent.
7. Add three activation gates: `Q_LIVE_EXECUTION_ENABLED`, exact account allowlist, and explicit live
   deployment activation. Defaults deny. The API/UI capability remains `live_locked` until a separate
   controlled-account validation record exists.
8. Extend the non-Windows MT5 stub only enough for imports and deterministic fake contract tests.

## Guardrails

- Do not weaken paper defaults or auto-discover/approve an account.
- Never log passwords or include credentials in persisted raw request data.
- Do not hard-code `ORDER_FILLING_RETURN`; select a symbol-supported policy.
- Do not infer fill from `order_send` success alone; reconcile deal/position state.
- Do not execute a real order as part of this WO.
- Completion wording must say implemented, locked, and operationally unvalidated.

## Tests

- Fake-MT5 contract tests cover buy/sell/close translation across execution/filling modes.
- Volume/price normalization and unsupported symbol/session/fill-policy rejection.
- `order_check` failure, send rejection, requote, partial result, done, timeout, and `None` response.
- Unknown-outcome recovery finds existing order/deal/position and never resends.
- External deal deduplication and net-position reconciliation.
- Every activation-gate combination defaults to denial unless all gates and validation record pass.
- Linux stub boot remains green; run targeted execution/market-data tests and full `uv run pytest`.

## Docs

Document locked capability, configuration, retcode mapping, reconciliation procedure, and the future
controlled-account validation checklist. Do not publish a live-ready claim.

## Definition of done

The live adapter satisfies the broker contract under deterministic tests and cannot submit in the
current unvalidated environment.

## Out of scope

Real-order validation, enabling live controls, pending orders, hedging, or production certification.
