# Paper and Live Execution

## Status and scope

This design adds Q's first forward-execution path. The first supported runtime is internal paper
trading for M15-and-slower closed-bar strategies. A live MetaTrader 5 adapter is built behind hard
safety gates, but live submission remains locked and operationally unvalidated until a controlled
trading account is available.

Tick and sub-second execution, hedging, portfolios, pending orders, and high-frequency operation are
out of scope.

## Decisions

- Use one broker-neutral execution domain with `PaperBroker` and `MetaTraderBroker` adapters.
- Run one immutable saved strategy version against one symbol and timeframe per deployment.
- Permit multiple independent deployments.
- Hold at most one net position per deployment: long, short, or flat.
- Evaluate only completed bars. A signal becomes executable after its source bar closes.
- Support market orders only in the first release.
- Use an internal paper account. An MT5 demo account is not required.
- Keep the API and Dramatiq CPU pool outside the execution hot path.
- Expose execution through a new top-level frontend workspace.

## Architecture

### Execution worker

A dedicated single-process execution worker owns deployment scheduling and all MT5 calls. It is not
an API background task and is not part of the CPU-bound Dramatiq pool. This preserves MT5's
thread-affine terminal connection, avoids competing worker processes, and gives order submission one
serialized owner.

The worker separates two paths:

- **Hot path:** completed-bar detection, bounded indicator evaluation, risk checks, quote retrieval,
  order submission/fill, and immediate durable state changes.
- **Control path:** REST commands, deployment configuration, history queries, audit inspection, and
  frontend polling.

The worker keeps active deployment state and rolling bar windows in memory. A bar coordinator fetches
each `(symbol, timeframe)` once per boundary and shares the completed bar among consumers. It fetches
only new bars during steady state and never reloads unbounded history. Restart recovery may replay a
bounded window or bars since entry to reconstruct stateful exit rules, but replay cannot emit orders.

### Domain and persistence

Postgres stores paper accounts, immutable deployments, bar decisions, order intents, fills, net
positions, ledger entries, risk events, worker leases, and the global kill-switch state. Execution
persistence is mandatory: if intent or state cannot be committed, the system fails closed.

Important uniqueness boundaries include:

- one decision for `(deployment_id, bar_close_time)`;
- one active net position per deployment;
- one fill identity per broker/external deal ticket;
- one active lease owner per deployment.

The system records intent before external submission. If submission may have occurred but its outcome
was not durably recorded, the order enters `unknown` and must be reconciled; it is never blindly
resent.

### Strategy evaluation

The evaluator builds strategies through the existing registry/factory and preserves the current
causal contract: strategies see completed bars and do not choose fill prices. It reuses the existing
entry, exit-rule, and position-sizing semantics without invoking `BacktestEngine.run()` or creating a
second strategy DSL.

Each deployment references an immutable saved strategy/config hash. A `(deployment, bar close)`
decision records the strategy version/hash, input bar timestamp, signal, sizing inputs, and reason.
Restarts resume after the last committed decision and cannot replay it into another order.

### Broker interface and paper fills

The broker-neutral interface provides health, account snapshot, executable quote, order submission,
positions, fills, and reconciliation operations.

`PaperBroker` uses fresh MT5 quotes but never sends a trading request. Buys and short covers fill at
ask; sells and short entries fill at bid. Configured deterministic slippage and commission are then
applied. Because top-of-book data cannot prove available depth, the first release uses full market
fills or rejection and does not invent partial fills.

The paper ledger atomically records cash changes, realized P&L, fees, position changes, and fill
identity. Unrealized P&L is marked from current executable quotes.

### Risk and lifecycle

Before every order, the risk gate checks:

- global kill switch and deployment lifecycle;
- worker lease ownership;
- bar and quote freshness;
- symbol/session availability;
- quantity, volume step, and configured notional limits;
- one-position invariant;
- paper buying power/equity;
- maximum daily realized loss.

Operational commands have explicit meanings:

- **Pause:** stop evaluating new bars and retain the position.
- **Stop:** terminate evaluation and retain the position unless flatten is explicitly requested.
- **Flatten:** submit a close at the current executable quote.
- **Kill switch:** block all new orders across deployments. Existing positions remain visible and can
  be flattened through the emergency path.

Stale data, a lost lease, an unavailable database, or an ambiguous broker result blocks new orders.

## Unknown orders and reconciliation

An order enters `UNKNOWN` with `ReconciliationState.PENDING` whenever its broker outcome cannot be
durably confirmed: a crash window between intent commit and fill persistence, or a fill-persistence
failure after the broker responded. A pending unknown is not a dead end — it is read, resolved, and
until then it _blocks_ new orders for its deployment.

### State machine

```text
UNKNOWN / PENDING ──broker confirms fill──────────► FILLED   / RECONCILED   (ledger + position applied)
UNKNOWN / PENDING ──broker rejects / not-found────► REJECTED / RECONCILED   (ledger untouched, intent released)
UNKNOWN / PENDING ──broker unavailable────────────► UNKNOWN  / PENDING       (attempt timestamp + error recorded)
```

Who may transition:

- **The worker (`reconciler`)** resolves automatically. It calls the broker's read-only
  `lookup_order(client_order_id)` capability, which returns filled (with fill details), rejected,
  not-found, or unavailable. The `PaperBroker` keeps no external state of its own — Q's ledger is
  authoritative — so a still-unknown paper order provably never filled and resolves to _not-found_.
  The `MetaTraderBroker` reconciles from deal history via the intent magic/comment.
- **An operator** resolves manually through the API when the broker cannot answer. The request
  carries an explicit outcome (`filled` with details, or `not_filled`) plus who and why; there is no
  "assume it's fine" default. Who/when/why are recorded on the order row (`reconciled_by`,
  `reconciled_at`, `reconciliation_detail`).

Reconciliation never re-submits. Resolution is read-and-record only; the decision to resend a signal
stays with the strategy on later bars. It fails closed: if the broker is unreachable the order stays
`PENDING`, the deployment stays blocked, and there is no time-based auto-expiry.

### Blocking rule

The pre-trade risk gate rejects any new order for a deployment that has an unresolved unknown, with
the structured code `unknown_prior_order`. Because a resolved order leaves `UNKNOWN` status, clearing
the last pending unknown automatically unblocks the deployment.

### Production triggers

The worker runs reconciliation at two points: once at startup recovery (immediately after
`ExecutionRecovery` marks incomplete orders unknown, before the poll loop emits any decision) and on
every poll cycle for each leased deployment that still has a pending unknown.

### API surface

- `GET /api/v1/execution/deployments/{id}/reconciliation` — list orders awaiting reconciliation.
- `POST /api/v1/execution/orders/{order_id}/resolve` — operator manual resolution (explicit outcome).
- Unresolved-unknown counts appear in the deployment detail and health payloads.

## MT5 live adapter

`MetaTraderBroker` translates domain orders into MT5 requests. It verifies terminal/account trading
permissions, the exact allowlisted account, symbol visibility, volume min/max/step, price precision,
quote freshness, and a fill policy supported by the symbol.

It runs `order_check()` before `order_send()`, while recognizing that a successful check does not
guarantee execution. It retains the raw request/result and retcodes, then reconciles through active
orders, positions, and deal history. The intent ID is carried in the supported magic/comment fields
for crash-window lookup, but Q does not assume those fields alone prove a fill.

Live submission requires all three gates:

1. a global environment enable flag;
2. an exact account-number allowlist;
3. explicit live activation on the deployment.

Without a controlled account, automated tests use a fake MT5 module to cover translation, retcodes,
partial/unknown outcomes, and reconciliation. The UI must display `LIVE LOCKED`, and documentation
must not call the adapter production-ready.

Reference: [MT5 Python integration](https://www.mql5.com/en/docs/python_metatrader5),
[`order_check()`](https://www.mql5.com/en/docs/python_metatrader5/mt5ordercheck_py), and
[`order_send()`](https://www.mql5.com/en/docs/python_metatrader5/mt5ordersend_py).

## API and frontend

The execution API creates paper accounts and deployments, exposes status/history/health, and accepts
start, pause, stop, flatten, and kill-switch commands. Request handlers never execute orders.

A new top-level `Execution` workspace shows:

- paper account balance, equity, daily P&L, and risk limits;
- deployment lifecycle and worker/market-data health;
- positions, decisions, orders, fills, fees, and rejection reasons;
- pause, stop, flatten, and global kill-switch controls;
- an explicit `PAPER` mode marker and unavailable `LIVE LOCKED` state.

Research and Backtests may promote an immutable eligible strategy into a prefilled paper deployment.
They do not create another execution path. Unsaved or mutable form state must be saved/versioned
before deployment.

## Performance contract

The initial target is M15/H1 closed-bar execution, not tick/sub-second trading. On the target machine,
the paper path has a p95 budget of 500 ms from MT5 exposing the completed bar to a committed fill.
Instrumentation reports completed-bar detection, indicator evaluation, risk checks, quote/fill, and
persistence separately.

The hot path has no REST, Redis, frontend, full-history reload, per-tick database write, or Dramatiq
hop. If future requirements become sub-second, the design must be revisited around an event-driven
MQL5/native gateway rather than stretching this Python path.

## Verification

- Strategy-decision parity fixtures compare forward evaluation with the existing closed-bar contract.
- Duplicate bar delivery, retry, lease takeover, and injected crash windows cannot duplicate orders.
- Ledger tests prove cash/P&L/fee conservation across long, short, close, and reversal flows.
- Paper tests cover spread, slippage, commission, stale quotes, and risk rejection.
- Recovery tests reconstruct state without emitting historical orders.
- Fake-MT5 contract tests cover validation, retcodes, unknown outcomes, and reconciliation.
- Performance tests report phase timings and enforce the 500 ms p95 paper budget.
- Frontend tests cover lifecycle controls, bounded visible-only polling, emergency confirmations, and
  unambiguous `PAPER` / `LIVE LOCKED` language.

## Delivery sequence

```text
WO167 ─┬─► WO168 ─┐
       └─► WO169 ─┴─► WO170 ─┬─► WO171 ──► WO173 ──► WO174
                              └─► WO172
```

WO168 and WO169 can run in parallel after WO167. Once WO170 stabilizes the broker boundary and
worker lifecycle, WO172 can run alongside the API/frontend stream.
