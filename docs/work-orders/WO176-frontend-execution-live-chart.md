# WO176 — Frontend: live strategy chart on the Execution workspace

## Shared context (read first)

Read the WO171 and WO175 completion contracts. The Execution workspace (WO173) controls paper
deployments but gives no visual feedback after Start — only JSON history rows. This WO adds a live
chart panel: completed bars + the strategy's **backend-computed** indicator series (WO175
contract), decision/fill markers from the existing history endpoints, and the live in-progress
price from the existing market endpoints. Indicators are never recomputed client-side — the chart
must show exactly what the worker evaluates.

Frontend repo: `q_frontend`, pnpm (never npm). Verify with `pnpm test:run`, typecheck, and build.

## Files to read

- WO175 completion message (chart JSON contract) — the panel is built against it
- `src/workspaces/execution/ExecutionWorkspace.tsx` and its tests
- `src/api/queries/execution.ts` — polling/queries pattern (`EXECUTION_POLL_MS`, key factory)
- `src/components/charts/CandlestickChart.tsx` and `src/components/charts/types/chart.ts` —
  `IndicatorConfig` is a union of *client-computed* types; this WO adds a precomputed-series path
- `src/components/charts/layers/IndicatorLayer.tsx`, `layers/OscillatorPane.tsx`
- `src/api/queries/market.ts` (or equivalent) — live snapshot/OHLCV for the forming bar
- `src/types/execution.ts`, `src/types/api.ts` (`OhlcvBar`)

## Goal

While a deployment runs, the operator watches price form in real time against the strategy's own
indicator lines, sees each decision/fill land on the chart, and understands that the strategy acts
only on bar closes.

## Tasks

1. Types + query: add the WO175 chart payload types to `src/types/execution.ts`, a
   `fetchDeploymentChart` / `useDeploymentChart(deploymentId, bars)` query in
   `src/api/queries/execution.ts` following the existing polling pattern (5s, off-route disabled
   via the same `pollingEnabled` guard).
2. Precomputed indicator support in the chart stack: extend the chart so a series of
   `{key, label, pane, color, values}` aligned to the supplied bars renders directly —
   price-pane overlays and oscillator panes per the payload's `pane` field — without touching the
   existing client-computed `IndicatorConfig` behavior used by the Market workspace.
3. Live forming bar: merge the current in-progress bar (from the existing market snapshot/OHLCV
   endpoints, polled at the market cadence) onto the end of the completed-bars series, visually
   distinguished (e.g. reduced opacity). Indicator series simply don't extend into it.
4. Decision/fill markers: map the existing decisions (buy/sell/close, skipping `hold`) and fills
   for the selected deployment onto chart timestamps as markers with hover detail (action, reason,
   quantity, price).
5. New "Live chart" panel in `ExecutionWorkspace` for the selected deployment: symbol/timeframe
   header, the chart, a "decisions occur at bar close" note, and a countdown to
   `next_bar_close_time` from the payload. Place it above History; keep the existing layout
   otherwise intact.
6. Degradation: pre-WO175 backend (404 on the chart endpoint) → panel shows a marked
   "chart unavailable" state, everything else on the page works; 503 (market data down) → stale
   chart retained with a status note, never an error wall.

## Guardrails

- No client-side recomputation of strategy indicators — render backend values only.
- Polling stops when the workspace is off-route (same guard as every other execution query) and
  when no deployment is selected.
- Don't refetch the full chart payload more often than the execution poll; rely on the backend's
  new-bar cache. The forming-bar quote poll is the only faster loop.
- Market workspace chart behavior stays pixel-identical (additive props only, defaults unchanged).
- No optimistic marker rendering — markers come from persisted decisions/fills only.

## Tests

- Query hook test: polling gated by `pollingEnabled` and deployment selection.
- Chart: precomputed overlay + oscillator series render from a fixture payload (including `null`
  warm-up values); existing indicator tests unmodified and green.
- Markers: decisions/fills fixture maps to the right bars; `hold` decisions skipped.
- Workspace: panel renders for a selected deployment, 404 → unavailable state, 503 → stale-note
  state; existing `ExecutionWorkspace` tests stay green.
- `pnpm test:run`, typecheck, and build.

## Definition of done

Start a paper deployment, watch the chart: strategy indicator lines from the backend, live forming
bar ticking, decision/fill markers appearing after bar closes, and a countdown that makes the
closed-bar contract obvious — with the page degrading cleanly against an older backend.

## Out of scope

WebSockets/streaming, tick charts, chart drawings/profiles for this panel, backtest-vs-live
overlay comparison, and any backend change (WO175).
