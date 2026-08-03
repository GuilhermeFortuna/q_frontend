# Runtime performance verification (WO101)

Repeatable gates for Q's cinematic shell across **browser dev**, **MSW mocks**, **live backend**, and **Tauri/WebKitGTK on Linux**. These checks protect visual quality by catching compositor and runtime regressions early — they do not authorize removing cinematic effects.

See also: [performance budgets](../src/lib/performance/budgets.ts) (WO96), [material system](../src/styles/materials.css) (WO98), and the [work-order acceptance gates](./work-orders/README.md#performance-acceptance-gates-wo101).

---

## Runtime matrix

| Command                           | What runs                                         | Best for                                                 |
| --------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| `./dev.sh --web`                  | Postgres/Redis + API + worker + Vite in browser   | Fast HMR, Playwright smoke, React Query against live API |
| `./dev.sh --mocks`                | Vite only (`VITE_ENABLE_MSW=true`)                | UI/shell work without backend; predictable data          |
| `./dev.sh` (default)              | Full stack + **Tauri desktop** (`pnpm tauri:dev`) | Desktop shell, window chrome, WebKitGTK compositor       |
| `./dev.sh --podman`               | Same as default but **Podman** for Postgres/Redis | Fedora/Linux path closest to reported Tauri stutter      |
| `cd q_frontend && pnpm dev`       | Vite only (uses `.env`)                           | Frontend-only when backend already running               |
| `cd q_frontend && pnpm tauri:dev` | Tauri + Vite (expects backend separately)         | Desktop without `dev.sh` bootstrap                       |

From repo root, `./dev.sh --web` and `./dev.sh --mocks` are the usual browser-mode entry points. Use `./dev.sh --podman` when validating **Linux desktop compositor** behavior with containerized Postgres/Redis.

---

## Enable WO96 performance HUD

In `q_frontend/.env` or inline:

```bash
VITE_PERF_HUD=true
```

Restart Vite/Tauri after changing env. The HUD appears bottom-right and logs `[perf]` objects to the console ~1.5s after each route change.

Programmatic snapshot (HUD enabled):

```js
window.__Q_PERF_SNAPSHOT__?.()
```

---

## Expected budgets (observability)

| Signal                                   | Target / ceiling                                                       | Notes                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| FPS                                      | **≥ 55** in browser dev                                                | Tauri may read lower during resize; watch for sustained drops |
| Long tasks                               | warn at **≥ 50ms**                                                     | Spike on route change is OK; repeated spikes on hover are not |
| Always-on canvases (non-3D routes)       | **0**                                                                  | Launcher may show **1** cinematic canvas                      |
| Feature renderer (`/strategy-builder`)   | **1 canvas**, **1 RAF loop**                                           | WO217 AI inference signal; route-scoped exception             |
| App-shell animation loops (non-launcher) | **0**                                                                  | Loops belong in `CinematicScene` / feature 3D                 |
| Route mount queries                      | launcher **12**, backtests **20**, discover **16**, market-data **18**, strategy-builder **20** | Soft ceilings from WO96                                       |
| Inactive-route refetches                 | **0** ideal                                                            | Amber in HUD when background queries refetch after navigation |

Workspace grid-reconfiguration (WO215 / P-001) uses transient GSAP Flip clones only. Idle canvas
and shell animation-loop counts must stay unchanged across repeated dock navigations; no persistent
RAF or always-on transition canvas is allowed.

Operational failure (WO219 / P-005) may mount **one** local `FaultyTerminalField` canvas and one
registered `faulty-terminal-field` loop **only while** a genuine failure surface is visible
(`OperationalFailureState` on Market empty+error or FeatureIslandBoundary). Healthy, loading,
empty-without-error, and stale-chart states must show **0** failure canvases / loops. The loop is
capped ≤20 fps, paused when the tab is hidden or the field is offscreen, static under reduced
motion, and disposed on unmount. Always-on and AppShell ceilings above are unchanged.

Quantitative number flow (WO221 / P-007) uses Motion presence animations on opt-in live KPI
values only (`QuantNumberFlow` / `StatTile.animateValue`). It adds **0** canvases and **0**
persistent RAF / app-shell animation loops. Hidden tabs and reduced motion snap without listeners.

---

## Browser smoke script

With dev server running:

```bash
# Terminal 1 (repo root)
./dev.sh --mocks

# Terminal 2
cd q_frontend
pnpm perf:smoke
# optional: VITE_PERF_HUD=true in terminal 1, then:
pnpm perf:smoke -- --hud
```

Script: [`scripts/perf-smoke.mjs`](../scripts/perf-smoke.mjs)

It headlessly opens `/`, `/backtests`, `/discover`, `/market-data`, `/strategy-builder`, records:

- navigation timing
- canvas count
- console errors and GPU/compositor-like warnings
- optional WO96 snapshot / `[perf]` logs

Install browser driver once:

```bash
pnpm add -D playwright
pnpm exec playwright install chromium
```

---

## Browser vs Tauri / WebKitGTK

| Topic                   | Browser (Chromium) | Tauri (WebKitGTK on Linux)                                          |
| ----------------------- | ------------------ | ------------------------------------------------------------------- |
| Engine                  | Chrome/Blink       | WebKitGTK                                                           |
| Compositor              | OS + Chrome        | Mutter/KWin + WebKit; often **more sensitive** to blur/canvas       |
| `backdrop-filter`       | Usually cheaper    | Can trigger full-window repaints                                    |
| `requestAnimationFrame` | Stable             | Can stutter if GPU driver + Wayland sync issues                     |
| Window chrome           | N/A                | Frameless custom header (`decorations: false` in `tauri.conf.json`) |
| Verification            | `pnpm perf:smoke`  | Manual checklist below                                              |

**Browser green does not imply Tauri green.** Shell/cinematic PRs require at least one Tauri/Linux pass or an explicit deferral with steps.

---

## Tauri manual checklist

1. **Launch:** `./dev.sh --podman` (or `./dev.sh` with Docker). Confirm no OS-wide mouse/desktop stutter on startup.
2. **HUD:** set `VITE_PERF_HUD=true` in `q_frontend/.env`, restart.
3. **Navigate:** Launcher → Backtests → Discover → Market Data. Record HUD after ~2s on each route.
4. **Heavy surfaces:** open AI Strategy panel (Backtests setup), expand a chart/results view, open 3D terrain/swarm if available.
5. **Logs:** watch `.dev/logs/api.log` and the Tauri terminal for WebKit/GPU lines.
6. **Record:** paste a table like:

| Route          | FPS | Canvas | Loops | Mount Q | Long tasks | Notes |
| -------------- | --- | ------ | ----- | ------- | ---------- | ----- |
| `/`            |     |        |       |         |            |       |
| `/backtests`   |     |        |       |         |            |       |
| `/discover`    |     |        |       |         |            |       |
| `/market-data` |     |        |       |         |            |       |

---

## Linux-specific notes

### Wayland vs X11

- **Wayland** is default on modern Fedora/GNOME. WebKitGTK + NVIDIA is a common stutter source.
- If stutter is Wayland-only, try an X11 session for A/B comparison (same app, different compositor).
- `echo $XDG_SESSION_TYPE` — `wayland` or `x11`.

### NVIDIA explicit sync

`dev.sh` applies when an NVIDIA GPU is detected and Tauri mode is active:

```bash
export __NV_DISABLE_EXPLICIT_SYNC=1
```

Disable only for debugging:

```bash
__NV_DISABLE_EXPLICIT_SYNC=0 ./dev.sh --podman
```

### Frameless chrome

`tauri.conf.json` sets `decorations: false`. Custom drag regions (`data-tauri-drag-region`) handle window moves. If stutter correlates with resize/drag, test with normal decorations temporarily (local experiment only — not a product change).

### Capturing GPU / compositor warnings

- Tauri/WebKit: run from a terminal and watch stderr.
- GNOME: `journalctl --user -f` while reproducing.
- Chromium smoke: `pnpm perf:smoke` collects console lines matching gpu/webgl/compositor patterns.

---

## What each mode verifies

| Mode          | API truth              | Compositor    | Cinematic shell | Good gate for                           |
| ------------- | ---------------------- | ------------- | --------------- | --------------------------------------- |
| `--mocks`     | MSW fixtures           | Browser       | Yes             | Cards, routing, materials, smoke script |
| `--web`       | Live FastAPI           | Browser       | Yes             | Query mount budgets, real latency       |
| Tauri default | Live API               | **WebKitGTK** | Yes             | Desktop stutter, blur, canvas           |
| `--podman`    | Live API in containers | **WebKitGTK** | Yes             | Full-stack Linux desktop                |

---

## When to run

- After **WO97–WO100** shell/cinematic changes
- Before merging PRs that touch `AppShell`, materials, `CinematicScene`, lazy islands, or Tauri config
- When users report **mouse/desktop stutter** on Linux

---

## Related files

- [`dev.sh`](../../dev.sh) — monorepo launcher, NVIDIA workaround, `--web` / `--mocks` / `--podman`
- [`tauri-dev.js`](../tauri-dev.js) — dynamic dev URL/port for Tauri
- [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json) — window decorations, build hooks
- [`vite.config.ts`](../vite.config.ts) — Tauri HMR host, build targets (`safari13` on Linux)
- WO96 — [`PerformanceHud`](../src/components/performance/PerformanceHud.tsx), [`budgets.ts`](../src/lib/performance/budgets.ts)
