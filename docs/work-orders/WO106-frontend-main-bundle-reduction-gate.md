# WO106 — Frontend: reduce remaining main bundle after feature-island split

## Shared context (read first)

Frontend-only WO. Use `pnpm`, never `npm`.

Depends on **WO99** and benefits from **WO102** for runtime smoke verification.

**Review finding:** the WO99 split created useful route chunks, but production build still reports a
large main `index` chunk around 1.49 MB minified. For a Tauri app that already showed launch
stutter, the main chunk should keep shrinking as the app grows.

## Goal

Turn the current bundle warning into a concrete follow-up gate:

- identify what remains in the main chunk;
- move route- or feature-specific code out of startup;
- keep launcher startup visually rich and responsive;
- document a budget and verification command for future PRs.

## How the pieces work today

Read:

- `vite.config.ts`
- `src/app/App.tsx`
- `src/app/router.tsx`
- `src/app/lazyWorkspaces.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/cinematic/*`
- `src/components/islands/*`
- `src/components/ui/*`
- `package.json`
- latest `pnpm build` output.

## Tasks

### 1. Inspect the main chunk

Add a lightweight bundle inspection workflow. Options:

- use Vite/Rollup output plus manual source inspection;
- add a temporary visualizer only if acceptable for the repo;
- use `rollupOptions.output.manualChunks` if it clearly improves chunking.

Identify whether these are still pulled into startup:

- heavy charting libraries;
- Three/drei pieces not required for the shell;
- PDF/report export dependencies;
- modal/dialog stacks only needed after interaction;
- AI strategy modules;
- market-data or discovery-specific utilities.

### 2. Move feature-only imports behind islands

Where safe, convert eager imports to lazy feature islands:

- export/report generation;
- heavy modals;
- standalone chart windows;
- 3D feature dependencies;
- workspace-only chart/table libraries.

Do not create layout jumps. Keep premium skeletons and reserved dimensions.

### 3. Add a bundle budget note

Document current and target startup chunk sizes in either:

- `docs/runtime-performance.md`; or
- a short `docs/dev/bundle-splitting.md`.

Set a practical next budget rather than an arbitrary ideal. For example:

- main `index` chunk should trend below 1 MB minified;
- any exception must explain why the code is true startup code.

### 4. Verify runtime and visuals

Bundle splitting must not regress route behavior or visual polish. Verify:

- Launcher first paint still shows the cinematic shell;
- Backtests/Discover/Market Data lazy-load correctly;
- fallbacks are branded and dimension-stable;
- no new console errors.

## Visual guardrails

> Do not remove the cinematic shell to reduce the bundle. Move feature weight out of startup.

> Loading states must look intentional, not like broken delayed UI.

## Tests

- `pnpm build`
- `pnpm test:run -- tests/unit/app/lazyRoutes.test.ts tests/unit/components/featureIslands.test.tsx`
- `pnpm test:run`
- `pnpm exec tsc -p tsconfig.app.json --noEmit`

## Manual verification

With the fixed WO102 HUD if available:

- capture build chunk output before/after;
- run browser smoke across `/`, `/backtests`, `/discover`, `/market-data`;
- verify no route loses core functionality after lazy-load boundaries.

## Definition of done

- Main chunk contents are documented.
- At least one concrete startup-weight reduction lands, or a defensible budget exception is written.
- `pnpm build` output shows the new chunking result.
- Visual loading behavior is preserved or improved.
- Required test/typecheck/build commands pass.

## Out of scope

- Rewriting the router.
- Removing product visuals.
- Backend performance work.
