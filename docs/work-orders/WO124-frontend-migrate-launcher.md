# WO124 — Frontend: migrate Launcher onto the design system

## Shared context (read first)

Two-repo project on Windows. Frontend `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, `pnpm`.

- Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`.

Read `docs/design/visual-design-system.md`. Depends on **WO116/117**, follows **WO118**. Mechanical,
behavior-preserving swap.

**Principle:** the Launcher is the first impression — a dashboard of entry panels. It already uses the
pointer-spotlight (`surface-panel--spotlight`). Keep the spotlight (it's a signature tier-2/3 moment) but
let panels/cards adopt the new warm-black elevation.

## How the pieces work today (read these files)

- `src/workspaces/launcher/LauncherWorkspace.tsx` — shell.
- `src/components/launcher/LauncherDashboard.tsx`, `launcherPanelLayout.ts` — the dashboard grid + layout.
- `src/components/effects/PointerSpotlight.tsx` — spotlight driver (pairs with `surface-panel--spotlight`).

## Goal

Launcher dashboard tiles read as `+1` raised cards with the warm-black treatment; the spotlight remains as
the hover/interactive accent.

## Tasks

1. **Dashboard tiles** — launcher entry panels → `EntityCard` (or `Panel` where they're containers, not
   selectable). Preserve `launcherPanelLayout` and spotlight wiring (`is-lit` / `--spot-*`).
2. **Headers/labels** → `SectionHeader`/`PanelHeader`.
3. **Any stat/summary readouts** → `StatTile`.
4. **Parity** — navigation into each workspace, spotlight tracking, layout all behave identically.

## Guardrails

> Behavior-preserving re-skin only. Keep `PointerSpotlight` + `surface-panel--spotlight` (this is the one
> page where the spotlight stays — it's the launcher's signature). No inline gradients, no new deps.

## Tests

- Update launcher tests where markup changed. Suite green: `pnpm test:run`.

## Docs

- `docs/design/visual-design-system.md`: tick WO124.

## Definition of done

- `pnpm test:run` green, typecheck clean, `pnpm build` succeeds — **do not report completion until all pass.**
- Paste-in-final-message: confirm Launcher parity + spotlight intact; list files changed.

## Out of scope

- Other pages (**WO122–123, WO125–126**); any launcher behavior/navigation change.
