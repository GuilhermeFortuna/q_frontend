# Quant Desktop Frontend (`q_frontend`)

[![Tauri Version](https://img.shields.io/badge/tauri-v2.2-blue?style=for-the-badge&logo=tauri)](https://tauri.app/)
[![React Version](https://img.shields.io/badge/react-v19.0-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![Vite Version](https://img.shields.io/badge/vite-v6.0-646cff?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![Tailwind v4](https://img.shields.io/badge/tailwind-v4.0-38bdf8?style=for-the-badge&logo=tailwind_css)](https://tailwindcss.com/)
[![Package Manager](https://img.shields.io/badge/pnpm-workspace-orange?style=for-the-badge&logo=pnpm)](https://pnpm.io/)

`q_frontend` is a state-of-the-art desktop-first interface for **Quant**. Built as a native desktop application shell using **Tauri 2**, it executes a web-rendered React application engineered with **React 19**, **Vite 6**, and **TypeScript**, styled around a custom, high-fidelity premium dark theme.

---

## 🏛 Strategic System Architecture

Quant separates heavy computations (market data pipelines, algorithmic backtesting, local broker connections) from rendering. This frontend is optimized to present complex real-time datasets with smooth micro-animations.

```
       ┌─────────────────────────────────────────────────────────┐
       │                     Tauri Desktop Shell                 │
       │                                                         │
       │  ┌───────────────────────┐   ┌───────────────────────┐  │
       │  │  React UI (Webview)   │   │  Rust Native Layer    │  │
       │  │  · Workspaces         │   │  · Shell plugins      │  │
       │  │  · Recharts Graphs    │◀─▶│  · File integrations  │  │
       │  │  · Zustand Store      │   │  · App OS Lifecycle   │  │
       │  └──────────┬────────────┘   └───────────────────────┘  │
       └─────────────┼───────────────────────────────────────────┘
                     │
                     │ HTTP API / JSON REST
                     ▼
       ┌─────────────────────────────────────────────────────────┐
       │            Quant API Backend (q_backend)                │
       │               FastAPI + MetaTrader 5                  │
       └─────────────────────────────────────────────────────────┘
```

For a comprehensive guide on the full engineering framework and long-term directions (including future React Three Fiber layers, Theatre.js, and Remotion compositions), see [docs/q-frontend-tech-stack.md](docs/q-frontend-tech-stack.md).

---

## ✨ Features & Modules

### 1. Unified Workspace Environment

The app shell uses a glassmorphic **dock** for workspace navigation. The dock shows live progress badges for any running job (backtest, optimization, walk-forward, or discovery) even when you are on another workspace.

- **Launcher Workspace:** Draggable dashboard with market watchlist panels, system health, recent backtest history, and news headlines. Opens articles in a separate Tauri reader window.
- **Market Data Workspace:** Immersive charting interface featuring high-frequency Recharts charts, real-time B3 price trackers, and historical candlesticks tables.
- **Backtests Workspace:** Configure and run strategies via the async backtest API, inspect OHLCV/trades charts with technical indicators, evaluate drawdown/equity curves, browse persisted run history, and export executive PDF reports. **Simulation setup** includes **StrategyStudio** — tabbed Entry / Exit & Targets editing with inline custom-strategy save/load (replacing the old library + flat detail panel). Picking a strategy auto-advances to Exit; the programmatic default selection does not. The focus workbench keeps setup and results mounted; `BacktestResultsTabs` is wrapped in `React.memo` so typing in config fields does not re-render the chart subtree. Results props (`results`, `request`, `equityCurve`, `monthlyStats`, etc.) must stay referentially stable across config edits — they are derived from run data in `BacktestsWorkspace`, not from live form state.
- **Chart performance:** Candlestick chart layers (`IndicatorLayer`, `VolumeLayer`, `OscillatorPane`, `GridLayer`, `CandlestickLayer`) memoize indicator values on `(data, params)` via `useIndicatorSeries` and rebuild SVG paths only when data, viewport scales, or indicator config change. Hover is RAF-throttled and updates only `CrosshairLayer` and the HUD — data layers do not recompute on pointer move.
- **Navigation & panel paint:** Route changes use the View Transitions API for **chrome only** (header + dock cross-fade); workspace `main` content swaps instantly so charts and 3D canvases are never full-page snapshotted. `.quant-panel` glass is a static ~90% opaque fill (no nested `backdrop-filter`); the pointer highlight lives on a compositor-isolated `::after` overlay driven by `PointerSpotlight`. Redundant `backdrop-blur` on already-opaque nested bands was removed; blur remains on modals and HUDs over live chart/3D content. `QuantBackground` (Three.js particle canvas) still runs on every page — gating it per workspace is a possible follow-up, out of scope for this paint pass.
- **Optimize Workspace:** Configurable Optuna-driven hyperparameter sweeps that support single/multi-objective optimization, real-time job cancellation, log streaming, and interactive Pareto Front / historical trial scatter charts.
- **Validate Workspace:** Walk-forward analysis — optimize in-sample per window, test out-of-sample, compare IS/OOS metrics, and inspect stitched OOS equity curves.
- **Discover Workspace:** Strategy search (discovery) — sweep registered candle strategies, walk-forward validate each candidate, and browse an OOS-ranked leaderboard. When the backend sends exit preset/policy labels and `exit_quality` diagnostics, candidate detail panels show exit distribution and path-quality stats; older runs without that metadata render unchanged.
- **Research Workspace:** Feature intelligence shell at `/research` with three tabs — **Feature Store**, **Feature Scoring**, and **Feature Lab** — backed by a typed react-query layer (`src/api/queries/features.ts`) and MSW fixtures (`src/mocks/features.ts`). Tab selection persists in `?tab=store|scoring|lab` for deep links. Panel UIs land in WO138–141; **Neural Features** is deferred until backend Phase 3/4. See [docs/design/feature-intelligence.md](docs/design/feature-intelligence.md).
- **Execution Workspace:** Paper execution control plane at `/execution` — inspect accounts, deployments, positions, and paginated audit history; start/pause/stop with explicit retained-position language; confirmed flatten and global kill switch. Typed client: `src/api/queries/execution.ts` (WO171 contracts). MSW fixtures: `src/mocks/execution.ts`. API health is shown separately from worker and market-data health. Live trading remains **locked** in UI and backend.
- **System Workspace:** System diagnostics, data-lake sync telemetries, and live FastAPI connection heartbeats.

The former standalone `/strategy` route redirects to **Backtests**; custom strategy authoring lives in Backtests → Simulation (**StrategyStudio**).

- **News Reader:** Secondary Tauri window (`?news_id=…` or `/news-reader`) for reading market headlines without leaving the main shell.
- **Executive PDF Report Export:** Native Tauri-driven high-fidelity HTML-to-PDF report generation for exporting formatted backtest results directly to the user's filesystem.

### 2. High-Fidelity Design Tokens

Custom tailored around the **Quant Visual Identity** in `src/styles/globals.css`:

- 🌑 **Carbon & Graphite backgrounds:** Deep dark mode designed to minimize cognitive load.
- 🏺 **Aged Brass accents:** Exquisite metallic indicator colors.
- 🪙 **Smoked Silver typography:** Elegant contrast weights utilizing modern sans-serif typefaces.
- 🎛 **Low-Gloss Surfaces:** Sophisticated panel shading with glassy blur filters (glassmorphism).

### 3. Integrated API Mocking

- Fully integrated **Mock Service Worker (MSW v2)** intercepting browser network traffic.
- Enables full, high-speed offline UI iteration without requiring the FastAPI backend, Dramatiq worker, or MetaTrader terminal to be active.
- Feature Intelligence endpoints (`/api/v1/features`, `/api/v1/feature-eval`, …) are mocked in `src/mocks/features.ts` so the Research workspace batch (WO137–141) can ship UI against stable fixtures before the live API is wired.

### 4. Global Job Tracking

- `useActiveJobs` polls status for every in-flight job session (backtest, optimize, walk-forward, discover) from the always-mounted dock.
- React Query deduplicates by query key, so remounting a workspace reuses the same cache and in-flight requests.

---

## 📂 Project Directory Structure

```txt
q_frontend/
├── docs/                # Design guidelines, work orders, and architectural choices
│   ├── q-frontend-tech-stack.md
│   └── design/          # Long-form design docs (e.g. genetic strategy search)
├── src-tauri/           # Tauri 2 Desktop configuration and Rust shell entry
│   ├── tauri.conf.json  # Desktop sizing, capabilities, and permissions configuration
│   └── src/             # Rust desktop lifecycle entry points (including PDF print commands)
├── src/
│   ├── app/             # Router providers, Router tree, and App entry configuration
│   ├── api/             # Axios API client, query hooks, and TanStack Queries
│   │   └── queries/     # Per-domain hooks (backtests, optimize, features, …)
│   ├── hooks/           # Shared hooks (active jobs, global zoom, sparklines, …)
│   ├── store/           # Zustand global state (layout, job sessions, system status)
│   ├── styles/          # Custom Tailwind v4 styling variables and theme configurations
│   ├── lib/
│   │   └── reports/     # HTML templates for high-fidelity PDF report generation
│   ├── components/      # Reusable presentation components
│   │   ├── background/  # CSS/SVG interactive atmospheric grid meshes
│   │   ├── backtests/   # Backtest metrics, charts, and breakdown tables
│   │   ├── discover/    # Strategy search leaderboard and candidate detail panels
│   │   ├── dock/        # Glassmorphic application menu bar (dock)
│   │   ├── launcher/    # Launcher dashboard panels and watchlist widgets
│   │   ├── charts/      # Recharts OHLCV candle wrappers
│   │   ├── optimize/    # Optuna study workbench, results panel, and Pareto scatter charts
│   │   ├── walkforward/ # Walk-forward config, progress, and IS/OOS comparison charts
│   │   ├── tables/      # TanStack Table and Virtualized table displays
│   │   └── ui/          # Standard layout controls
│   ├── workspaces/      # Individual application workspaces
│   │   ├── launcher/    # Main application landing dashboard
│   │   ├── market-data/ # Live charts, asset parameters, and historical rates
│   │   ├── backtests/   # Run and inspect backtests; PDF export
│   │   ├── optimize/    # Optuna study runs and Pareto analysis
│   │   ├── walkforward/ # Walk-forward validation workbench
│   │   ├── discover/    # Strategy discovery / search workbench
│   │   ├── research/    # Feature Store · Scoring · Lab (WO137–141)
│   │   ├── news/        # News reader (standalone window route)
│   │   └── system/      # Telemetries, diagnostics, and connection endpoints
│   ├── types/           # Shared TypeScript models (API, features, strategies, …)
│   ├── mocks/           # Mock Service Worker (MSW) client-side handlers
│   └── main.tsx         # React bootstrap root
└── tests/               # Unit testing packages (Vitest + Testing Library)
```

---

## ⚡ Quickstart & Local Installation

### Prerequisites

1. **Node.js:** `v20` or higher.
2. **pnpm:** Enabled as package manager.
3. **Rust Toolchain:** Required to compile the desktop Tauri shell. Follow the [Tauri 2 prerequisites guide](https://v2.tauri.app/start/prerequisites/) for your platform.

### 1. Setup Dependencies

From the `q_frontend` directory, install packages and copy standard environmental settings:

```bash
pnpm install
cp .env.example .env
```

### 2. Configure Service Workers

Prepare the local MSW mock service worker inside the public assets folder:

```bash
npx msw init public --save
```

### 3. Build SVG Desktop Icons

Compile the desktop icons required by the Tauri packaging system:

```bash
pnpm tauri icon public/quant.svg
```

---

## 🚀 Development Runner Scripts

| Environment          | Command            | Description                                                                                    |
| :------------------- | :----------------- | :--------------------------------------------------------------------------------------------- |
| **Web (Browser)**    | `pnpm dev`         | Fast HMR dev server at [http://localhost:1420](http://localhost:1420) (Mocks enabled).         |
| **Desktop (Tauri)**  | `pnpm tauri:dev`   | Compiles the Rust shell and loads the React app inside the local desktop window.               |
| **Test Suite**       | `pnpm test:run`    | Execute Vitest unit tests in continuous integration mode.                                      |
| **Type Check**       | `pnpm typecheck`   | Run the TypeScript compiler to ensure strict typing correctness.                               |
| **Formatting**       | `pnpm format`      | Auto-format codebase using Prettier.                                                           |
| **Linting**          | `pnpm lint`        | Analyze files for code quality issues using ESLint.                                            |
| **Production Build** | `pnpm build`       | Compiles optimized React assets.                                                               |
| **Installer Bundle** | `pnpm tauri:build` | Generates a distribution desktop installer (MSI/EXE).                                          |
| **Perf smoke**       | `pnpm perf:smoke`  | Headless browser route smoke (see [docs/runtime-performance.md](docs/runtime-performance.md)). |

### Runtime performance gates (WO101)

Shell and cinematic PRs must follow [docs/runtime-performance.md](docs/runtime-performance.md):

- Run `pnpm perf:smoke` with `./dev.sh --mocks` or `--web` when touching shell/materials/routing.
- Run **Tauri/Linux** (`./dev.sh --podman`) for compositor-sensitive changes, or defer with exact manual steps in the PR.
- Enable `VITE_PERF_HUD=true` to compare FPS, canvas count, query mounts, and long tasks against [budgets](src/lib/performance/budgets.ts).

---

## 🔌 Connecting to the Live Backend

To transition from mock data to the live `q_backend` service:

1. Open your `.env` file.
2. Set `VITE_ENABLE_MSW` to `false` to disable the MSW network interceptors.
3. Point `VITE_API_BASE_URL` to your running FastAPI server address:
   ```ini
   VITE_API_BASE_URL=http://localhost:8000
   VITE_ENABLE_MSW=false
   ```
4. Start `q_backend` with MetaTrader 5 active:
   ```bash
   docker compose up -d          # Postgres + Redis
   uv run alembic upgrade head
   uv run uvicorn q_backend.api.main:app --reload --port 8000
   uv run worker                 # required for backtests, optimize, walk-forward, discover
   ```
5. Launch `pnpm dev` or `pnpm tauri:dev`.

Without the Dramatiq worker, async jobs enqueue successfully but never execute.

### Integrated API Integrations (q_backend ↔ q_frontend)

The frontend communicates with the following FastAPI endpoints (see `q_backend/README.md` for full request/response shapes):

#### Core System & Market Data

- `GET /api/v1/system/health` — MetaTrader 5 status, Postgres/Redis health, data lake status.
- `GET /api/v1/market/instruments` — Available assets (`PETR4`, `VALE3`, `WIN$`, …).
- `GET /api/v1/market/snapshot/{symbol}` — Real-time bid/ask quote.
- `GET /api/v1/market/snapshots` — Batch watchlist snapshots.
- `GET /api/v1/market/ohlcv/{symbol}` — Last 30 daily candles for charting.

#### Backtesting

- `GET /api/v1/strategies` — Strategy registry and parameter schemas for dynamic forms.
- `POST /api/v1/backtest` — Start an async backtest (poll status, then fetch result).
- `GET /api/v1/backtest/{runId}` — Backtest job status.
- `GET /api/v1/backtest/{runId}/result` — Full metrics, trades, bars, and indicators.
- `GET /api/v1/backtests` — Paginated run history.
- `GET /api/v1/backtests/{runId}` — Run metadata and summary metrics.
- `PATCH /api/v1/backtests/{runId}` — Bookmark runs (`saved_only`).
- `GET /api/v1/backtests/{runId}/artifacts/equity` — Equity curve from the Parquet lake.
- `GET /api/v1/backtests/{runId}/artifacts/trades` — Trades from the Parquet lake.

#### Optuna Optimization

- `POST /api/v1/optimize` — Start an optimization study.
- `GET /api/v1/optimize/{studyId}` — Study status and progress.
- `POST /api/v1/optimize/{studyId}/cancel` — Cancel a running study.
- `GET /api/v1/optimize/{studyId}/results` — Trials, Pareto front, and best parameters.
- `GET /api/v1/optimizations` — Paginated study history.

#### Walk-forward (Validate workspace)

- `POST /api/v1/walkforward` — Start a walk-forward run.
- `GET /api/v1/walkforward/{runId}` — Run status and window progress.
- `GET /api/v1/walkforward/{runId}/results` — Per-window IS/OOS metrics and stitched equity.
- `POST /api/v1/walkforward/{runId}/cancel` — Cooperative cancellation.
- `GET /api/v1/walkforwards` — Paginated history.
- `GET /api/v1/walkforward/{runId}/artifacts/equity` — Stitched OOS equity curve.

#### Strategy search (Discover workspace)

- `POST /api/v1/strategy-search` — Start a discovery run.
- `GET /api/v1/strategy-search/{runId}` — Candidate and window progress.
- `GET /api/v1/strategy-search/{runId}/results` — OOS-ranked leaderboard.
- `POST /api/v1/strategy-search/{runId}/cancel` — Cooperative cancellation.
- `GET /api/v1/strategy-searches` — Paginated history.
- `GET /api/v1/strategy-search/{runId}/candidates/{candidateId}/artifacts/equity` — Candidate OOS equity.

#### Feature intelligence (Research workspace)

- `GET /api/v1/features` — Feature Store catalog (`category`, `status` filters).
- `GET /api/v1/features/{name}` — Feature Passport (versions, history, score).
- `POST /api/v1/features/{name}/{version}/status` — Promote/demote lifecycle status.
- `GET /api/v1/features/leaderboard` — Latest global scores per feature.
- `POST /api/v1/feature-eval` — Start a feature evaluation run.
- `GET /api/v1/feature-eval/{runId}` — Run status, leaderboard, clusters, heatmap.

Frontend hooks: `src/api/queries/features.ts` (`useFeatureList`, `useFeaturePassport`, `useFeatureLeaderboard`, `useFeatureEvalRun`, `useSetFeatureStatus`, `useStartFeatureEval`). With `VITE_ENABLE_MSW=true`, MSW serves the same shapes from `src/mocks/features.ts`.

---

## 🧩 Adding Custom UI Components

The project includes pre-configured **shadcn/ui** settings. When adding new component primitives:

```bash
npx shadcn@latest add button card input dialog -y
```

Make sure to re-skin newly added shadcn components inside `src/styles/globals.css` to match our custom low-gloss carbon theme and avoid standard generic Tailwind templates.
