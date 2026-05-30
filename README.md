# Quant Frontend (`q_frontend`)

Desktop-first TypeScript application for Quant: **Tauri 2** shell, **React 19 + Vite 6 + TypeScript**, aligned with [docs/q-frontend-tech-stack.md](docs/q-frontend-tech-stack.md).

## Phase 1 (current)

- Tauri desktop shell (config + Rust entry)
- TanStack Router, Query, Table
- Zustand global client state
- Tailwind v4 design tokens (carbon / brass / silver)
- Workspaces: **Launcher**, **Market Data**, **System**
- Recharts OHLCV chart + instruments table
- MSW mock API for local development
- Vitest, ESLint, Prettier, Husky

Later phases (not scaffolded yet): R3F, Theatre.js, Remotion, live WebSocket streams, full shadcn component set.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri)
- Windows: [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually preinstalled on Windows 11)

## Setup

```bash
cd q_frontend
npm install
cp .env.example .env
npx msw init public --save
npm run tauri icon public/quant.svg
```

`msw init` creates `public/mockServiceWorker.js`. `tauri icon` generates `src-tauri/icons/*` required for desktop builds.

## Development

**Browser only (fast UI iteration):**

```bash
npm run dev
```

Open http://localhost:1420 — MSW mocks are enabled by default in development.

**Full desktop app:**

```bash
npm run tauri:dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server on port 1420 |
| `npm run tauri:dev` | Tauri + Vite |
| `npm run build` | Production web build |
| `npm run tauri:build` | Desktop installer |
| `npm run test:run` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |

## Project layout

```txt
src/
  app/           Router, providers, App root
  api/           Axios client + TanStack Query modules
  components/    UI, layout, dock, charts, tables, background
  mocks/         MSW handlers + fixture data
  store/         Zustand slices
  styles/        Tailwind v4 + Quant tokens
  workspaces/    launcher, market-data, system
  scene/         (Phase 4) R3F ambient scene
  remotion/      (Phase 5) video compositions
src-tauri/       Tauri 2 Rust shell
tests/unit/      Vitest tests
```

## Backend integration (Phase 2)

Point `VITE_API_BASE_URL` at the q_backend FastAPI server and set `VITE_ENABLE_MSW=false` when real endpoints are available:

```txt
GET /api/v1/system/health
GET /api/v1/market/instruments
GET /api/v1/market/snapshot/:symbol
GET /api/v1/market/ohlcv/:symbol
```

Mock handlers in `src/mocks/handlers.ts` mirror this contract for Phase 1.

## Adding shadcn components

`components.json` is preconfigured. Install primitives as needed:

```bash
npx shadcn@latest add button card input -y
```

Re-skin components to match Quant tokens in `src/styles/globals.css`.
