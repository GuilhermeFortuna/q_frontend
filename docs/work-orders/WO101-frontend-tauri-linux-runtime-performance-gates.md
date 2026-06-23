# WO101 — Frontend: Tauri/Linux runtime performance gates

## Shared context (read first)

Frontend/Tauri WO. Backend changes are not expected.

Depends on **WO96** instrumentation. Should run after at least one of WO97-WO100 lands, then become a
recurring verification gate for cinematic shell work.

**Context:** Browser dev is not enough. The stutter symptom is most severe when running the desktop
app via `dev.sh --podman`, where Tauri/WebKitGTK, Linux compositor, GPU driver, and containerized
backend behavior all interact.

## Goal

Create a repeatable runtime verification procedure and lightweight gates for:

- `./dev.sh --web`
- `./dev.sh --mocks`
- `./dev.sh --podman`
- Tauri desktop shell
- Linux/Wayland/NVIDIA or other GPU-sensitive setups

The gates must protect the cinematic direction by catching compositor/runtime regressions before more
features are added.

## How the pieces work today

Read:

- `dev.sh`
- `q_frontend/tauri-dev.js`
- `q_frontend/src-tauri/tauri.conf.json`
- `q_frontend/src-tauri/src/*.rs`
- `q_frontend/vite.config.ts`
- `q_frontend/src/app/router.tsx`
- `q_frontend/src/components/layout/AppShell.tsx`
- WO96 performance HUD implementation.

## Tasks

### 1. Document runtime matrix

Add `q_frontend/docs/runtime-performance.md` with:

- commands for `--web`, `--mocks`, `--podman`;
- what each mode verifies;
- known runtime differences between browser and Tauri/WebKitGTK;
- how to enable the WO96 performance HUD;
- how to capture console/GPU warnings;
- expected budgets.

### 2. Add a scripted smoke checklist

Create a small script if practical, for example `q_frontend/scripts/perf-smoke.mjs`, that can:

- open key routes in browser mode;
- collect console warnings/errors;
- check canvas counts;
- optionally record rough route load timings.

Do not overbuild a full benchmark framework unless the repo already has one.

### 3. Tauri-specific verification notes

Add a manual checklist for Tauri:

- launch with `./dev.sh --podman`;
- verify no OS-wide stutter on launch;
- navigate Launcher, Backtests, Discover, Market Data;
- open AI panel, chart/results, 3D views if available;
- record WO96 HUD readings;
- capture GPU/compositor warnings from logs if available.

Include Linux-specific notes for:

- Wayland vs X11 if applicable;
- NVIDIA explicit sync workaround already present in `dev.sh`;
- normal window decorations vs custom frameless chrome if stutter persists.

### 4. Introduce performance acceptance gates for future WOs

Update `q_frontend/docs/work-orders/README.md` or `q_frontend/README.md` with a reusable checklist:

- no new always-on canvas without budget note;
- no app-wide animation loop outside `CinematicScene`;
- no repeated `backdrop-filter` on dense surfaces;
- hidden panes must not poll/fetch/mount heavy modules;
- Tauri smoke check required for shell/cinematic changes.

## Visual guardrails

> Runtime gates must protect cinematic quality. Do not encode “remove visuals” as the fix.

> If a runtime cannot support a given effect cheaply, require an equivalent cheaper rendering path,
> not a visual downgrade.

## Tests

- Script tests if a script is added.
- Documentation links are valid.
- `pnpm test:run`
- `pnpm exec tsc -p tsconfig.app.json --noEmit`
- `pnpm build`

## Manual verification

Must run at least browser mode. If Tauri/Podman cannot be run in the agent environment, final message
must say so clearly and list the exact manual steps for the developer.

## Definition of done

- Runtime performance doc exists.
- Smoke script or explicit checklist exists.
- Future-WO performance gates are documented.
- Browser-mode verification has been run.
- Tauri/Podman verification has either been run or explicitly deferred with exact instructions.
- Required test/typecheck/build commands pass.

## Out of scope

- Implementing the cinematic renderer.
- Refactoring panels/materials.
- Backend worker/process tuning.
