# WO219 — Frontend: Operational Failure Terminal

## Shared context (read first)

Run only after VISUAL D. Selected source: React Bits
[Faulty Terminal](https://reactbits.dev/backgrounds/faulty-terminal). Inspect the exact source,
record revision/capture/files/hashes/dependencies, and retain only its recognizable terminal-grid,
scan/interference behavior. Read `ChartPanel.tsx`, `ExecutionLiveChartPanel.tsx`,
`FeatureIslandBoundary.tsx`, error Callout rules, and runtime budgets.

## Goal

Create one reusable `OperationalFailureState` for genuine system unavailability. Pilot it in the
Market chart's no-bars error state and the lazy feature-island load failure. It must signal “the
instrument is unavailable” without turning normal loading, empty data, or stale-but-usable charts
into error spectacle.

## Files

```text
src/components/status/OperationalFailureState.tsx
src/components/status/FaultyTerminalField.tsx
src/components/status/__tests__/OperationalFailureState.test.tsx
src/components/market/ChartPanel.tsx
src/components/market/__tests__/ChartPanel.test.tsx
src/components/islands/FeatureIslandBoundary.tsx
src/components/islands/__tests__/FeatureIslandBoundary.test.tsx
docs/design/premium-component-upgrades.md
docs/runtime-performance.md
```

## State policy

- Use for a real error with no usable content: failed initial market history, rejected lazy island,
  or explicitly offline/unavailable state passed by the parent.
- Never replace loading, zero-result/empty states, validation errors, ordinary form Callouts, or a
  chart retained with stale data. Existing Execution 503 stale-chart behavior remains unchanged.

## Implementation contract

1. Adapt Faulty Terminal as a bounded background layer inside the failure surface: low-density grid,
   restrained horizontal interference, brass/silver signal with rose reserved for the status glyph.
   Content and retry controls remain crisp HTML above it. Remove provider palette and demo copy.
2. API: `title`, `description`, optional `code`, `onRetry`, `compact`, and `testId`. The component owns
   presentation only; parents decide error policy and retry behavior.
3. Pilot A: `ChartPanel` uses it only when `!isInitialLoading && bars.length===0 && error`. Preserve the
   current neutral no-data copy when there is no error. Never cover a non-empty/stale chart.
4. Pilot B: `FeatureIslandBoundary` uses compact mode and keeps its existing retry/reset contract,
   logged feature label, and error-boundary semantics.
5. Prefer CSS/SVG/DOM port if it preserves the signature. If the source is shader/canvas-bound, the
   canvas is local, mounts only while that failure is visible, uses an invalidation/event-driven or
   capped <=20 fps loop, registers with performance instrumentation, pauses when hidden/offscreen,
   and disposes fully. Never mount it in AppShell or change always-on budgets.
6. Reduced motion renders a static grid/scan composition. Text contrast meets WCAG AA, retry is first
   class keyboard focus, and animation is `aria-hidden`.

## Guardrails

- No error-wall rollout beyond the two pilots in this order.
- Do not replace charts, alter query retry semantics, fabricate error codes, or expose raw stack
  traces/server bodies.
- Do not use `feTurbulence` or image noise; the Q design system forbids printed/noise textures.

## Verification

- Tests: exact state policy, retry, no animation semantics, static reduced-motion mode, no canvas in
  healthy/loading/empty/stale states, error-boundary reset.
- Existing market/execution 404/503 tests must remain green. Run `pnpm test:run`, `pnpm typecheck`,
  `pnpm lint`, `pnpm build`, `pnpm perf:smoke`, `git diff --check`.
- Manual: failed history, ordinary empty range, stale chart, lazy chunk failure/retry, desktop/mobile,
  reduced motion, hidden tab, Tauri/WebKitGTK. Record mount/loop counts before/after retry.

## Definition of done

The selected terminal behavior is recognizable but contained, real failure policy is honest, and
healthy/stale data remains usable. Handoff includes source/hash, policy matrix, captures, runtime
counts, commands, and stops at `REVIEW` for VISUAL E.

## Out of scope

Loading animation, global offline mode, toast redesign, backend error changes, or applying the effect
to all Callouts.
