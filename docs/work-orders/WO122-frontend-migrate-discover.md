# WO122 — Frontend: migrate Discover onto the design system

## Shared context (read first)

Two-repo project on Windows. Frontend `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, `pnpm`.

- Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`.

Read `docs/design/visual-design-system.md` (**Component inventory**). Depends on **WO116** (materials),
**WO117** (primitives), and follows the pattern proven in **WO118** (Backtests pilot). Component APIs are
locked at Checkpoint B — this is a mechanical, behavior-preserving swap.

**Principle:** identical to WO118 — swap inline idioms for `ui/` primitives, no logic/store/payload changes.
Page-isolated; if you discover a missing primitive need, prefer reuse — only extend a WO117 primitive if
genuinely shared, and note it.

## How the pieces work today (read these files)

- `src/workspaces/discover/DiscoverWorkspace.tsx` — shell.
- `src/components/discover/` — `DiscoverConfigForm.tsx`, `DiscoverGatesSection.tsx`,
  `DiscoverGeneticSection.tsx`, `DiscoverProgress.tsx`, `DiscoverResultsPanel.tsx`,
  `CandidateDetailPanel.tsx`, `ExitInsightPanel.tsx`, `GeneticVerdictPanel.tsx`, `LeaderboardTable.tsx`,
  `DiscoverHistoryPanel.tsx`, `DiscoverLogs.tsx`, `GenomeViewer.tsx`. The 3D swarm
  (`LiveSwarmVisualizer3D`) is left as-is except its containing surface.

## Goal

Discover renders through WO117 primitives on WO116 surfaces, matching the Backtests look.

## Tasks

1. **Panels/headers** — config sections, gates, genetic params, results, history → `Panel`/`PanelHeader`/
   `SectionHeader`.
2. **Controls** — preset/segmented choices (gate toggles, genetic mode pickers, any min/max/step params) →
   `SegmentedToggle` / `RangeChips` / `RangeInput`; labels/hints/errors → `LabeledField`.
3. **Cards** — candidate/result tiles in `DiscoverResultsPanel` / `CandidateDetailPanel` /
   `GeneticVerdictPanel` → `EntityCard` where they're selectable; verdict/insight metrics → `StatTile`.
4. **Running state** — live/optimizing indicators use tier-4 utilities (`live-status-dot`,
   `quant-panel--active-run`), not ad-hoc glows.
5. **Parity** — leaderboard, swarm, logs, history selection all behave identically.

## Guardrails

> Behavior-preserving re-skin only. No new deps, no inline gradients. Keep `LeaderboardTable` /
> `react-table` wiring intact — only its surrounding surfaces + header re-skin.
> 3D/swarm internals untouched; only the panel that frames them adopts `surface-*`.

## Tests

- Update Discover tests where markup queries changed (prefer role/label queries). Suite green: `pnpm test:run`.

## Docs

- `docs/design/visual-design-system.md`: tick WO122.

## Definition of done

- `pnpm test:run` green, typecheck clean, `pnpm build` succeeds — **do not report completion until all pass.**
- Paste-in-final-message: confirm Discover renders via primitives with parity; list files changed.

## Out of scope

- Other pages (**WO123–126**); any Discover behavior change.
