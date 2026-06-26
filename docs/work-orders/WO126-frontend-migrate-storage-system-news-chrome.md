# WO126 — Frontend: migrate Storage + System + News + app chrome (finish the rollout)

## Shared context (read first)

Two-repo project on Windows. Frontend `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, `pnpm`.

- Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`.

Read `docs/design/visual-design-system.md`. Depends on **WO116/117**, follows **WO118**. The final rollout
WO — covers the lighter remaining workspaces and the persistent chrome, completing full-UI coverage.

**Principle:** mechanical, behavior-preserving swaps. After this WO, **every** workspace + the global chrome
renders through the design system; nothing inline-styled remains.

## How the pieces work today (read these files)

- Workspaces: `src/workspaces/storage/StorageWorkspace.tsx`, `src/workspaces/system/SystemWorkspace.tsx`,
  `src/workspaces/news/NewsReaderWorkspace.tsx`.
- App chrome: `src/components/layout/AppShell.tsx`, `WindowControls.tsx`, `BrightnessToggle.tsx`,
  `DigitalClock.tsx`, `ReaderWindowShell.tsx`; `src/components/dock/AppDock.tsx`, `DockIcons.tsx`. The
  header/dock already use `surface-shell` (re-skinned in WO116) + view-transition utilities (`vt-*`).

## Goal

Storage, System, News, and the header/dock all read through the design system — full-UI consistency.

## Tasks

1. **Storage / System / News** — panels/headers → `Panel`/`PanelHeader`/`SectionHeader`; any forms/controls
   → `LabeledField` + the relevant control primitives; lists/cards → `EntityCard`; readouts → `StatTile`.
   News reader (`ReaderWindowShell`) content surfaces adopt level 0/+1 appropriately.
2. **Header** — `AppShell` top bar: title cluster, `DigitalClock`, `BrightnessToggle`, `WindowControls`,
   the `PHASE 1 · FOUNDATION` pill. Header stays `surface-shell`; the phase pill → tier-1/3 treatment;
   keep `vt-header` view-transition.
3. **Dock** — `AppDock`/`DockIcons`: active item = `accent-state` (tier 3), idle = structural; keep
   `vt-dock` + existing dock behavior. The active-page indicator (`ActiveOutline`) re-skins to the ladder.
4. **Global overlays** — confirm `ConfirmDialog` + any popovers use `surface-overlay` (+2). Verify the
   `quant-noise-overlay` / `quant-vignette-overlay` still sit correctly over the warm-black base.
5. **Parity** — theme/brightness toggle, window controls, dock navigation, news reading, storage/system
   actions all behave identically.

## Guardrails

> Behavior-preserving re-skin only. **Do not change** view-transition utilities (`vt-header/dock/main`),
> window-control behavior, or the noise/vignette overlays' stacking — only their surface treatment aligns
> to WO116. No inline gradients, no new deps.

## Tests

- Update storage/system/news + chrome tests where markup changed. Suite green: `pnpm test:run`.

## Docs

- `docs/design/visual-design-system.md`: tick WO126 and mark the batch **complete** (full-UI coverage).

## Definition of done

- `pnpm test:run` green, typecheck clean, `pnpm build` succeeds — **do not report completion until all pass.**
- Paste-in-final-message: confirm Storage/System/News + header + dock render via the design system with
  parity, and that **no page renders inline-styled surfaces anymore**; list files changed.

## Out of scope

- New behavior anywhere; backend changes. This WO closes the WO116–126 visual-elevation batch.
