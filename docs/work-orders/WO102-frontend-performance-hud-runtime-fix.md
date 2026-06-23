# WO102 — Frontend: fix performance HUD runtime instrumentation

## Shared context (read first)

Frontend-only WO. Use `pnpm`, never `npm`.

Depends on **WO96** and **WO101**.

**Review finding:** enabling `VITE_PERF_HUD=true` currently crashes the app in Chromium with
`TypeError: Illegal invocation` from `PerformanceInstrumentation`. This blocks the WO96/WO101
runtime gates and makes every later performance claim untrustworthy.

## Goal

Make the developer performance HUD and smoke runner reliable again:

- no runtime crash when `VITE_PERF_HUD=true`;
- `window.__Q_PERF_SNAPSHOT__` is available while the HUD is enabled;
- `pnpm perf:smoke -- --hud` can collect route samples;
- the instrumentation remains opt-in and cheap.

## How the pieces work today

Read:

- `src/lib/performance/performanceMonitor.ts`
- `src/lib/performance/usePerformanceStore.ts`
- `src/components/performance/PerformanceInstrumentation.tsx`
- `src/components/performance/PerformanceHud.tsx`
- `src/lib/performance/perfSmokeLib.ts`
- `scripts/perf-smoke.mjs`
- `scripts/perf-smoke-run.ts`
- `docs/runtime-performance.md`

The immediate crash is caused by storing browser timer functions as unbound callbacks:

- `setInterval: typeof setInterval === 'function' ? setInterval : undefined`
- `clearInterval: typeof clearInterval === 'function' ? clearInterval : undefined`

When later called as object properties, Chromium can reject them as illegal invocations.

## Tasks

### 1. Fix browser API binding

In `performanceMonitor.ts`, make all browser callbacks safe to call through the dependency object:

- wrap or bind `setInterval` and `clearInterval`;
- keep `requestAnimationFrame` and `cancelAnimationFrame` bound;
- guard `window`, `document`, `performance`, and `PerformanceObserver` for Tauri/WebKitGTK.

### 2. Add a regression test for default deps

Add a unit test that exercises `createPerformanceMonitor().start()` with real-like timer shims and
asserts it does not throw when dependencies are called as object properties.

Also test `stop()` cleanup for the interval path.

### 3. Restore smoke-run usefulness

Run the browser smoke flow with HUD enabled:

```bash
cd q_frontend
VITE_PERF_HUD=true pnpm dev -- --host 127.0.0.1 --port 1421
pnpm perf:smoke -- --base-url http://127.0.0.1:1421 --settle-ms 1500 --hud --json
```

If port `1421` is unavailable, use another free port and record it in the final notes.

### 4. Tighten docs if behavior changed

Update `docs/runtime-performance.md` only if the enablement command, HUD behavior, or smoke script
usage changes.

## Visual guardrails

> This WO is instrumentation-only. It must not alter product visuals except the opt-in HUD.

## Tests

- `pnpm test:run -- tests/unit/lib/performance/performanceMonitor.test.ts tests/unit/components/PerformanceHud.test.tsx tests/unit/scripts/perf-smoke.test.ts`
- `pnpm test:run`
- `pnpm exec tsc -p tsconfig.app.json --noEmit`
- `pnpm build`

## Manual verification

- Launch browser dev with `VITE_PERF_HUD=true`.
- Verify the HUD appears on `/`, `/backtests`, `/discover`, and `/market-data`.
- Verify console has no `PerformanceInstrumentation` crash.
- Run `pnpm perf:smoke -- --hud` and paste the JSON or summarized readings in the final message.

## Definition of done

- HUD-enabled runtime no longer crashes.
- Smoke runner returns meaningful snapshots instead of `hudVisible=false` caused by a crash.
- Tests cover the timer binding regression.
- Required test/typecheck/build commands pass.

## Out of scope

- Changing performance budgets.
- Optimizing the cinematic renderer.
- Reworking route lazy loading.
