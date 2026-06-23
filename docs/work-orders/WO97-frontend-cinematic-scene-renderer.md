# WO97 — Frontend: unified cinematic scene renderer

## Shared context (read first)

Two-repo project:

- **Frontend** `q_frontend` — React/TypeScript/Vite/Tauri, use `pnpm` only.
- **Backend** not expected to change in this WO.

Depends on **WO96** instrumentation.

**Non-negotiable product direction:** Q must remain cinematic. This WO must preserve or improve the
visual ambition. Do not flatten the app, remove atmosphere, or make the UI generic.

## Goal

Replace scattered app-wide cinematic effects with one controlled `CinematicScene` runtime:

- one renderer/context;
- one animation loop;
- route-aware quality and intensity;
- fixed DPR cap;
- pause/throttle when hidden;
- no duplicate always-on WebGL canvases in header/dock/background;
- visual parity or upgrade versus the current shell.

React renders product UI. `CinematicScene` owns ambient atmosphere.

## How the pieces work today

Read:

- `src/components/background/QuantBackground.tsx`
- `src/components/brand/QuantEmblem.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/ReaderWindowShell.tsx`
- `src/components/dock/AppDock.tsx`
- `src/styles/globals.css`
- `src/hooks/useResolvedBrightness.ts`
- `src/hooks/usePrefersReducedMotion.ts`
- `src/store/useAppStore.ts`
- `public/high_brightness/*`, `public/mid_brightness/*`, `public/quant.svg`, `public/quant-emblem.glb`

Also review WO86 and any current shell performance patches. Work with current files; do not blindly
restore older versions.

## Tasks

### 1. Capture visual references first

Before changing visuals, capture screenshots or short video clips for:

- Launcher desktop;
- Backtests setup focused;
- Backtests results if available;
- Discover results if available;
- Market Data workspace.

Keep them in a temporary verification note or attach in the final response. Do not commit bulky
screenshots unless the repo already stores visual baselines.

### 2. Introduce `CinematicScene`

Create `src/components/cinematic/CinematicScene.tsx`.

Responsibilities:

- render ambient background image/texture;
- render dust/particles/light sweep/vignette as a single scene;
- expose quality/intensity based on active workspace;
- respect `prefers-reduced-motion`;
- stop or reduce animation when `document.hidden`;
- cap DPR, ideally `1` or configurable by quality mode;
- expose debug stats to WO96 instrumentation: active loop, quality mode, canvas count.

Implementation can use Three.js, Canvas2D, or a hybrid. Pick the approach that preserves the look
with the lowest compositor cost in Tauri/WebKitGTK.

### 3. Migrate current atmosphere into the scene

Move these visual responsibilities out of scattered DOM layers where practical:

- `QuantBackground` image switching;
- particle/dust ambience;
- vignette/noise ambience if it is expensive as fixed DOM overlays;
- global light movement.

The visual result should be at least as cinematic as today. Improving cohesion is encouraged.

### 4. Remove duplicate always-on renderers

Ensure non-3D workspaces have at most one cinematic renderer.

- Header emblem must not create a separate always-on WebGL context.
- Dock/header should not each own their own animation loops.
- 3D feature surfaces such as optimizer terrain or live swarm can keep their own canvas only when
  the feature is visible and active.

### 5. Route-aware quality

Define quality profiles:

- `launcher`: full ambience;
- `analysis`: reduced ambience behind dense operational workspaces;
- `heavy-3d`: cinematic scene paused/dimmed when a visible feature-specific 3D canvas is active;
- `reduced-motion`: static image/texture only.

Do not make dense workspaces visually plain. Use static richness when motion is reduced.

## Visual guardrails

> Visual regression is a blocker. If the new scene is smoother but less premium, the WO is not done.

> Preserve brand identity: brass/gold highlights, dark carbon/espresso depth, atmospheric motion,
> and premium launcher feel.

> Any simplification must be implementation-level, not aesthetic-level.

## Tests

- Component/smoke test that `CinematicScene` renders for normal app shell routes.
- Test that reduced-motion mode disables the animation loop.
- Test that hidden document or quality mode pauses/throttles if practical.
- `pnpm test:run`
- `pnpm exec tsc -p tsconfig.app.json --noEmit`
- `pnpm build`

## Manual verification

Using WO96 HUD:

- compare canvas count before/after;
- verify one app-wide cinematic renderer;
- verify no WebGL/GPU warnings on Backtests launch;
- capture before/after screenshots for the reference states.

If possible, verify in Tauri via `./dev.sh --podman`, not only browser dev.

## Definition of done

- `CinematicScene` owns app-wide cinematic ambience.
- Non-feature workspaces do not mount multiple always-on canvases.
- Launcher and Backtests look equal or better than before.
- WO96 metrics show no unexpected canvas/loop growth across navigation.
- Required test/typecheck/build commands pass.
- Final message includes visual comparison notes and perf readings.

## Out of scope

- Virtualizing tables/results.
- Lazy-loading AI/chart modules.
- Backend changes.
