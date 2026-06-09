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

For a comprehensive guide on the full engineering framework and long-term directions (including future React Three Fiber layers, Theatre.js, and Remotion compositions), please refer to the primary documentation:
👉 [docs/q-frontend-tech-stack.md](file:///c:/Users/guilherme/q/q_frontend/docs/q-frontend-tech-stack.md)

---

## ✨ Features & Modules

### 1. Unified Workspace Environment

- **Launcher Workspace:** Central hub for application entry, asset selectors, and starting backtesting jobs.
- **Market Data Workspace:** Immersive charting interface featuring high-frequency Recharts charts, real-time B3 price trackers, and historical candlesticks tables.
- **Backtests Workspace:** Detailed backtesting suite where developers can configure strategies, run performance tests, inspect OHLCV/trades charts with technical indicators, evaluate drawdown/equity curves, and analyze monthly breakdowns.
- **Optimize Workspace:** Configurable Optuna-driven hyperparameter sweeps that support single/multi-objective optimization, real-time job cancellation, log streaming, and interactive Pareto Front / historical trial scatter charts.
- **System Workspace:** System diagnostics, data-lake sync telemetries, and live FastAPI connection heartbeats.
- **Executive PDF Report Export:** Native Tauri-driven high-fidelity HTML-to-PDF report generation for exporting formatted backtest results directly to the user's filesystem.

### 2. High-Fidelity Design Tokens

Custom tailored around the **Quant Visual Identity** in `src/styles/globals.css`:

- 🌑 **Carbon & Graphite backgrounds:** Deep dark mode designed to minimize cognitive load.
- 🏺 **Aged Brass accents:** Exquisite metallic indicator colors.
- 🪙 **Smoked Silver typography:** Elegant contrast weights utilizing modern sans-serif typefaces.
- 🎛 **Low-Gloss Surfaces:** Sophisticated panel shading with glassy blur filters (glassmorphism).

### 3. Integrated API Mocking

- Fully integrated **Mock Service Worker (MSW v2)** intercepting browser network traffic.
- Enables full, high-speed offline UI iteration without requiring the FastAPI backend or MetaTrader terminal to be active.

---

## 📂 Project Directory Structure

```txt
q_frontend/
├── docs/                # Core design guidelines and architectural choices
│   └── q-frontend-tech-stack.md
├── src-tauri/           # Tauri 2 Desktop configuration and Rust shell entry
│   ├── tauri.conf.json  # Desktop sizing, capabilities, and permissions configuration
│   └── src/             # Rust desktop lifecycle entry points (including PDF print commands)
├── src/
│   ├── app/             # Router providers, Router tree, and App entry configuration
│   ├── api/             # Axios API client, query hooks, and TanStack Queries
│   ├── store/           # Zustand global state client stores (layout, system status)
│   ├── styles/          # Custom Tailwind v4 styling variables and theme configurations
│   ├── lib/
│   │   └── reports/     # HTML templates for high-fidelity PDF report generation
│   ├── components/      # Reusable atomic presentation components
│   │   ├── background/  # CSS/SVG interactive atmospheric grid meshes
│   │   ├── backtests/   # Backtest metrics, charts, and breakdown tables
│   │   ├── dock/        # Glassmorphic application menu bar (dock)
│   │   ├── charts/      # Recharts OHLCV candle wrappers
│   │   ├── optimize/    # Optuna study workbench, results panel, and Pareto scatter charts
│   │   ├── tables/      # TanStack Table and Virtualized table displays
│   │   └── ui/          # Standard layout controls
│   ├── workspaces/      # Individual application workspaces
│   │   ├── launcher/    # Main application landing dashboard
│   │   ├── market-data/ # Live charts, asset parameters, and historical rates
│   │   ├── backtests/   # Runs and showcases backtests, and allows PDF exporting
│   │   ├── optimize/    # Workbench for Optuna study runs and Pareto analysis
│   │   └── system/      # Telemetries, diagnostics, and connection endpoints
│   ├── mocks/           # Mock Service Worker (MSW) client-side handlers
│   └── main.tsx         # React bootstrap root
└── tests/               # Unit testing packages (Vitest + Testing Library)
```

---

## ⚡ Quickstart & Local Installation

### Prerequisites

1. **Node.js:** `v20` or higher.
2. **pnpm:** Enabled as package manager.
3. **Rust Toolchain:** Required to compile the desktop Tauri shell. Follow the [Tauri Installation Guide](https://tauri.app/v1/guides/getting-started/prerequisites) for your platform.

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

| Environment          | Command            | Description                                                                            |
| :------------------- | :----------------- | :------------------------------------------------------------------------------------- |
| **Web (Browser)**    | `pnpm dev`         | Fast HMR dev server at [http://localhost:1420](http://localhost:1420) (Mocks enabled). |
| **Desktop (Tauri)**  | `pnpm tauri:dev`   | Compiles the Rust shell and loads the React app inside the local desktop window.       |
| **Test Suite**       | `pnpm test:run`    | Execute Vitest unit tests in continuous integration mode.                              |
| **Type Check**       | `pnpm typecheck`   | Run the TypeScript compiler to ensure strict typing correctness.                       |
| **Formatting**       | `pnpm format`      | Auto-format codebase using Prettier.                                                   |
| **Linting**          | `pnpm lint`        | Analyze files for code quality issues using ESLint.                                    |
| **Production Build** | `pnpm build`       | Compiles optimized React assets.                                                       |
| **Installer Bundle** | `pnpm tauri:build` | Generates a distribution desktop installer (MSI/EXE).                                  |

---

## 🔌 Connecting to the Live Backend

To transition from Mock Data to the live `q_backend` service:

1. Open your `.env` file.
2. Set `VITE_ENABLE_MSW` to `false` to disable the MSW network interceptors.
3. Point `VITE_API_BASE_URL` to your running FastAPI server address:
   ```ini
   VITE_API_BASE_URL=http://localhost:8000
   VITE_ENABLE_MSW=false
   ```
4. Start `q_backend` with MetaTrader 5 active.
5. Launch `pnpm dev` or `pnpm tauri:dev`.

### Integrated API Integrations (q_backend 🔗 q_frontend)

The frontend communicates directly with the following FastAPI endpoints:

#### Core System & Market Data

- `GET /api/v1/system/health` ➡️ Tracks MetaTrader 5 status and API health.
- `GET /api/v1/market/instruments` ➡️ Fetches available assets list (`PETR4`, `VALE3`, `ITUB4`, etc.).
- `GET /api/v1/market/snapshot/{symbol}` ➡️ Real-time bid/ask tick data.
- `GET /api/v1/market/ohlcv/{symbol}` ➡️ Retrieves last 30 daily price candles.

#### Backtesting & Optuna Optimization

- `POST /api/v1/backtest/run` ➡️ Runs a strategy backtest and returns metrics and execution logs.
- `POST /api/v1/optimize` ➡️ Initiates a multi/single-objective hyperparameter optimization study.
- `GET /api/v1/optimize/{studyId}` ➡️ Polls the active optimization status and progress.
- `POST /api/v1/optimize/{studyId}/cancel` ➡️ Terminates a running optimization job.
- `GET /api/v1/optimize/{studyId}/results` ➡️ Fetches Optuna trials history, Pareto front, and best parameters.

---

## 🧩 Adding Custom UI Components

The project includes pre-configured **shadcn/ui** settings. When adding new component primitives:

```bash
npx shadcn@latest add button card input dialog -y
```

Make sure to re-skin newly added shadcn components inside `src/styles/globals.css` to match our custom low-gloss carbon theme and avoid standard generic Tailwind templates.
