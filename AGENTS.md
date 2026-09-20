# AGENTS.md

## Cursor Cloud specific instructions

This repo (`q_frontend`) is **only the frontend** of the Quant platform — a Tauri 2 desktop shell wrapping a React 19 + Vite web app. The FastAPI backend (`q_backend`, plus Postgres/Redis) lives in a sibling directory that is **not present** in this workspace. For all cloud development and testing, run the app in **web/browser mode against MSW mock data** (`VITE_ENABLE_MSW=true`), which needs no backend, database, or queue.

Standard commands (dev/lint/typecheck/test/build) are documented in `README.md` and `package.json` scripts — use those. Notes below are only the non-obvious caveats:

- **Run/dev:** `pnpm dev` serves the app at http://localhost:1420 with `strictPort: true` (fixed port; free it first if occupied). MSW intercepts all API calls, so every workspace (Launcher, Market Data, Backtests, Optimize, Validate, Discover, Research, System) works offline. A hello-world flow: open Backtests → select an entry strategy (e.g. MA Crossover) → **Run Simulation** → results (PNL, win rate, equity/drawdown charts) render from mocks. Live operations are in `q_terminal`; `/execution` shows a moved notice only.
- **Tests require Brazil timezone.** Run the suite as `TZ=America/Sao_Paulo pnpm test:run`. Several snapshot tests (e.g. `tests/unit/lib/backtesting/useBacktestConfig.test.ts`) encode UTC-3 day boundaries; under the VM's default UTC they fail with dates shifted by 3 hours even though the code is correct.
- **Generated, gitignored setup files.** `.env` (copied from `.env.example`) and `public/mockServiceWorker.js` (from `npx msw init public --save`) are both git-ignored, so they must be recreated on a fresh VM. The startup update script handles this; without `mockServiceWorker.js` the app loads but mocks won't intercept requests.
- **Tauri desktop mode is out of scope here.** `pnpm tauri:dev` / `pnpm tauri:build` need the Rust toolchain and a native GUI/window; browser mode (`pnpm dev`) is the path for cloud verification.
