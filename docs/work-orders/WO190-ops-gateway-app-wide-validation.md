# WO190 — Ops: validate the gateway feeding the whole app (E2E on Linux)

## Shared context (read first)

Final WO of the WO188–WO190 batch; **runs after WO188 and WO189 are merged**. Companion to
WO186 (which validated the gateway itself + the Storage page). This WO proves the expansion:
with the live gateway up (`mt5-gateway.service` on `127.0.0.1:18812`, Genial terminal under
Wine), every consumer surface gets fresh WIN$/WDO$ data, and the coverage planner keeps
gateway traffic down to the actual gaps. Mostly a scripted smoke + a manual checklist run on
the user's Linux box — the fleet writes the script/checklist and runs what it can against a
fake gateway; the live pass is executed with the user.

Two repos: backend `q_backend` (`uv`), frontend `q_frontend` (`pnpm`). Paths relative to
`C:\Users\guilherme\q\`. Local services: Postgres :5432, Redis :6380, `./dev.sh` boots
everything.

## How the pieces work today (read these files)

- `docs/design/mt5-remote-gateway.md` — architecture + the WO186 validation precedent
- `q_backend/gateway/mt5_gateway.py` — gateway request logging (each `/v1/*` hit is one log
  line; that log is the traffic meter for the coverage assertions)
- `src/q_backend/market_data/routing.py` + `service.py` — post-WO188 coverage behavior
- `src/q_backend/market_data/read_through.py` — post-WO189 research-pipeline seam
- `tests/integration_smoke/` — where the existing smoke suites live and their conventions

## Goal

A repeatable `tests/integration_smoke/test_gateway_app_wide.py` (skipped unless
`Q_MT5_GATEWAY_URL` points at a reachable gateway) plus a manual checklist doc, together
demonstrating: fresh data on every surface, correct gap-only gateway traffic, and graceful
offline degrade.

## Tasks

1. Scripted smoke (`tests/integration_smoke/test_gateway_app_wide.py`, opt-in via env like
   the other live smokes; every case also runnable against an in-process fake gateway so CI
   exercises the logic):
   - seed a temp `market_data_root` with a truncated local WIN$ M5 series (ends N days ago);
   - `MarketDataService.get_ohlcv` for a range ending now → returns bars past the old local
     end; local store envelope extended (fetch-through); a second identical read makes
     **zero** gateway requests (count via the fake's request log / live gateway log);
   - `read_ohlcv_fresh` (WO189) from a features-style call → same freshness;
   - gateway stopped + covered range → still served; uncovered → honest `ConnectionError`.
2. Manual checklist (`q_frontend/docs/dev/gateway-app-wide-validation.md`), one row per
   surface with exact steps + expected result, executed with the live gateway:
   - **Market page**: WIN$ chart shows today's session; available-range picker reaches today;
   - **Backtests Simulation**: run ending today produces trades in the fresh tail;
   - **Optimization / Discovery**: short job over a range ending today starts and completes;
     gateway log shows one OHLCV fetch per distinct range (the `tasks/data.py` job cache +
     WO188 planner), not per trial/candidate;
   - **Feature evaluation + neural gate + alpha preflight** (WO189 surfaces): a run over a
     fresh range completes with coverage through today;
   - **Storage page**: inventory reflects the bars persisted by the reads above (fetch-through
     visible to the user);
   - **Offline degrade**: `systemctl --user stop mt5-gateway` → previously-covered ranges
     still load everywhere; Storage acquisition honestly reports unavailable.
3. Fix-forward: small bugs found during the live pass are fixed in this WO when they are
   clearly in the WO188/189 surface; anything bigger gets written up in the final message
   for a follow-up WO, not patched ad hoc.

## Guardrails

> Do not weaken test isolation: the autouse conftest fixture that shields the unit suite
> from a live dev gateway stays intact; the live smoke opts in explicitly and must never
> run in the default `uv run pytest` invocation.
> No production code changes beyond fix-forward items traceable to WO188/189.
> The Wine gateway can be flaky — a flaky-infrastructure failure is an observation for the
> checklist, not a code bug to chase in this WO.

## Tests

The smoke file itself (fake-gateway mode must pass in CI / default-off live mode documented
at the top of the file). `uv run pytest` (default selection) must stay green and must not
touch the live gateway.

## Docs

The checklist doc is the deliverable; record the live-pass results inline (date, gateway
version, pass/fail per row) the way WO186's runbook did.

## Definition of done

`uv run pytest` passes — do not report completion until it does. Final message must
include: the checklist table with live-pass results (or, if the live gateway was unreachable
during execution, the fake-gateway results plus the exact commands the user runs to execute
the live pass), the observed gateway request counts proving gap-only traffic, and the list
of any fix-forward commits or follow-up WO candidates.

## Out of scope

`execution/` (live trading stays native-MT5-on-Windows); new gateway endpoints; performance
tuning beyond verifying the coverage planner works; the Gemini WO187.
