# WO125 — Frontend: migrate Walkforward / Validate onto the design system

## Shared context (read first)

Two-repo project on Windows. Frontend `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, `pnpm`.

- Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`.

Read `docs/design/visual-design-system.md`. Depends on **WO116/117**, follows **WO118**. Mechanical,
behavior-preserving swap. (The dock's **VALIDATE** entry is this Walkforward workspace.)

**Principle:** swap inline idioms for `ui/` primitives, no logic changes. This page is config-form + windows
table + results-heavy — a close cousin of Optimization, so lean on the same primitive choices proven in
WO118.

## How the pieces work today (read these files)

- `src/workspaces/walkforward/WalkForwardWorkspace.tsx` — shell.
- `src/components/walkforward/` — `WalkForwardConfigForm.tsx`, `WalkForwardWindowsSection.tsx`,
  `WalkForwardWindowsTable.tsx`, `WalkForwardProgress.tsx`, `WalkForwardResultsPanel.tsx`,
  `WalkForwardResultsView.tsx`, `WalkForwardHistoryPanel.tsx`, `IsOosComparisonChart.tsx`.

## Goal

Walkforward/Validate renders through WO117 primitives on WO116 surfaces.

## Tasks

1. **Panels/headers** — config, windows, results, history sections → `Panel`/`PanelHeader`/`SectionHeader`.
2. **Controls** — window params (min/max/step, anchored/rolling pickers) → `RangeInput` /
   `SegmentedToggle` / `RangeChips`; labels/hints/errors → `LabeledField`.
3. **Tables/metrics** — IS/OOS comparison metrics → `StatTile`; keep `WalkForwardWindowsTable` /
   `react-table` wiring, re-skin its frame + header only.
4. **Running state** — progress uses tier-4 utilities (`quant-panel--active-run`, `live-status-dot`).
5. **Parity** — running a walk-forward, window config, results/history selection behave identically.

## Guardrails

> Behavior-preserving re-skin only. Keep table + chart (`IsOosComparisonChart`) internals; only frames +
> headers + form controls re-skin. No inline gradients, no new deps.

## Tests

- Update walkforward tests where markup changed. Suite green: `pnpm test:run`.

## Docs

- `docs/design/visual-design-system.md`: tick WO125.

## Definition of done

- `pnpm test:run` green, typecheck clean, `pnpm build` succeeds — **do not report completion until all pass.**
- Paste-in-final-message: confirm Walkforward/Validate parity; list files changed.

## Out of scope

- Other pages (**WO122–124, WO126**); any walk-forward behavior change.
