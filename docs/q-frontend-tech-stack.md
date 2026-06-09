# Quant Frontend Tech Stack

## 1. Strategic Direction

Quant should be developed as a **desktop-first TypeScript application** using a lightweight native shell and a web-rendered UI.

```txt
Desktop shell: Tauri
UI runtime: React + Vite + TypeScript
Backend: Python q_backend over HTTP/WebSocket/gRPC
Cinematic assets: UE5 + Blender offline pipeline
Live 3D UI layer: React Three Fiber, introduced after the core UI is stable
```

The shipped application should **not** run inside Unreal Engine 5. UE5 should be used to create premium cinematic assets: logo animations, background loops, still renders, intro sequences, and visual references.

---

## 2. Core Architecture

```txt
q_frontend/
  Tauri desktop shell
  React/TypeScript app
  Vite dev/build pipeline
  R3F cinematic layer when needed
  UI workspaces for market data, research, backtests, system

q_backend/
  Python data/backend layer
  Market-data ingestion
  Parquet lake
  DataLoader/API layer
  Future backtesting/execution services

UE5 / Blender/
  Offline cinematic pipeline
  Logo scenes
  Motion studies
  Background loops
  Rendered assets
```

### Runtime boundary

```txt
React/Tauri app = product UI
Python backend = quant engine and data services
UE5/Blender = asset generation, not app runtime
```

---

## 3. Desktop Shell

### Chosen

| Layer         | Choice    | Reason                                                               |
| ------------- | --------- | -------------------------------------------------------------------- |
| Desktop shell | **Tauri** | Lightweight, fast startup, smaller installer, lower memory footprint |
| Alternative   | Electron  | Only if Node APIs inside the shell become necessary                  |

### Recommendation

Use **Tauri 2.x**.

Tauri is the right default because Quant is intended to feel like a premium native desktop application without shipping a full Chromium + Node runtime like Electron.

---

## 4. UI Framework

### Chosen

| Layer      | Choice         | Reason                                                                    |
| ---------- | -------------- | ------------------------------------------------------------------------- |
| Framework  | **React**      | Best ecosystem for data apps, charts, R3F, animation, and desktop web UIs |
| Build tool | **Vite**       | Fast HMR, simple config, excellent TS support                             |
| Language   | **TypeScript** | Required for financial/data-heavy correctness                             |

### Core packages

```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "typescript": "^5.5.0",
  "vite": "^6.0.0",
  "@vitejs/plugin-react": "^4.3.0",
  "vite-tsconfig-paths": "^5.0.0"
}
```

---

## 5. Routing

Use **TanStack Router**.

```json
{
  "@tanstack/react-router": "^1.58.0"
}
```

### Why

- Type-safe routes
- Good deep-linking
- Better fit than Next.js for a local desktop app
- No SSR complexity

---

## 6. State Management

Split state into separate layers.

| State type          | Library                           | Usage                                                               |
| ------------------- | --------------------------------- | ------------------------------------------------------------------- |
| Server/async state  | **TanStack Query**                | API calls, cached market data, polling, background refresh          |
| Global client state | **Zustand**                       | Workspace state, layout state, selected instruments, UI preferences |
| Immutable updates   | **Immer**                         | Cleaner Zustand slice updates                                       |
| Streams             | **RxJS**                          | Tick streams, live signals, execution updates later                 |
| WebSocket client    | **socket.io-client** or native WS | Live data/events                                                    |

```json
{
  "@tanstack/react-query": "^5.56.0",
  "@tanstack/react-query-devtools": "^5.56.0",
  "zustand": "^5.0.0",
  "immer": "^10.0.0",
  "rxjs": "^7.8.0",
  "socket.io-client": "^4.8.0"
}
```

---

## 7. Styling & Design System

Use a token-first styling system based on the Quant visual identity:

```txt
Carbon / Graphite backgrounds
Aged brass accents
Smoked silver typography
Low-gloss metallic surfaces
Subtle contour/wave-mesh background language
```

### Libraries

```json
{
  "tailwindcss": "^4.0.0",
  "@tailwindcss/vite": "^4.0.0",
  "tailwind-merge": "^2.5.0",
  "clsx": "^2.1.0",
  "lucide-react": "^0.460.0"
}
```

### Component primitives

```txt
Radix UI primitives
shadcn/ui component recipes
Custom Quant tokens/components on top
```

Use shadcn as copied source, not as a locked visual style. The components should be re-skinned around Quant's own carbon/brass/silver design language.

---

## 8. Animation Layer

### DOM/UI animation

Use **motion**.

```json
{
  "motion": "^11.5.0"
}
```

Use it for:

- dock hover/active states
- workspace transitions
- panel reveals
- layout animations
- button and modal motion
- subtle UI micro-interactions

### Rule

Keep UI animation precise, restrained, and engineered. Avoid bouncy SaaS-style movement.

---

## 9. Cinematic 3D Layer

### Primary live 3D stack

Use **React Three Fiber**, not a live UE5 runtime.

```json
{
  "three": "^0.168.0",
  "@types/three": "^0.168.0",
  "@react-three/fiber": "^8.17.0",
  "@react-three/drei": "^9.115.0",
  "@react-three/postprocessing": "^2.16.0"
}
```

Use R3F for:

- live ambient background scene
- subtle particle fields
- wave mesh / topographic terrain
- 3D logo previews
- reflective surfaces
- depth-of-field, bloom, vignette
- lightweight interactive 3D visualizations

### Dev tools

```json
{
  "leva": "^0.10.0",
  "r3f-perf": "^7.2.0"
}
```

Use Leva for live tuning:

- fog density
- bloom intensity
- camera position
- particle count
- light intensity
- material roughness/metalness

Use r3f-perf to enforce performance budgets.

---

## 10. Cinematic Sequencing

Use **Theatre.js** for timeline-based cinematic motion in R3F scenes.

```json
{
  "@theatre/core": "^0.7.0",
  "@theatre/r3f": "^0.7.0",
  "@theatre/studio": "^0.7.0"
}
```

Use Theatre.js for:

- launcher intro sequence
- logo reveal
- camera moves
- workspace transitions through 3D space
- guided data-story animations

### Production rule

`@theatre/studio` must be dev-only.

```ts
if (import.meta.env.DEV) {
  await import('@theatre/studio')
}
```

---

## 11. Video / Rendered Output

Use **Remotion** for programmatic video generation.

```json
{
  "remotion": "^4.0.0",
  "@remotion/player": "^4.0.0",
  "@remotion/cli": "^4.0.0",
  "@remotion/three": "^4.0.0"
}
```

Use Remotion for:

- backtest result videos
- strategy teardown reels
- animated equity curves
- drawdown highlight videos
- portfolio review exports
- onboarding videos
- shareable performance clips

### Structure rule

Keep Remotion compositions separate from live app components.

```txt
src/remotion/
  Root.tsx
  compositions/
    BacktestSummary.tsx
    StrategyTeardown.tsx
    PortfolioReview.tsx
```

---

## 12. UE5 / Blender Role

UE5 and Blender should be used as a **cinematic production pipeline**, not as the frontend runtime.

### Use UE5 for

- premium rendered background loops
- entry intro animation
- logo animation studies
- material development
- cinematic lighting references
- smoke/fog/dust scenes
- high-quality video/image assets

### Export to frontend as

```txt
.webm
.mp4
.png / .webp
image sequences
compressed texture assets
```

### Do not use UE5 for

- forms
- tables
- charts
- app navigation
- workspace layout
- backend integration
- shipped UI runtime

---

## 13. Data Visualization

### Standard charts

```json
{
  "recharts": "^2.13.0"
}
```

Use Recharts for:

- equity curves
- drawdown charts
- return distributions
- bar charts
- simple time series

### Advanced custom charts

```json
{
  "d3": "^7.9.0",
  "visx": "^3.11.0"
}
```

Use D3/visx for:

- custom correlation maps
- regime visualizations
- factor exposure views
- advanced interactive charts

### 3D/data-heavy charts

```json
{
  "plotly.js": "^2.35.0",
  "react-plotly.js": "^2.6.0"
}
```

Use Plotly for:

- volatility surfaces
- optimization landscapes
- 3D scatter/factor maps

### Tables

```json
{
  "@tanstack/react-table": "^8.20.0",
  "@tanstack/react-virtual": "^3.10.0"
}
```

Use for:

- OHLCV tables
- instrument master
- backtest trades
- logs
- parameter sweeps
- optimization results

---

## 14. Forms & Validation

```json
{
  "react-hook-form": "^7.53.0",
  "@hookform/resolvers": "^3.9.0",
  "zod": "^3.23.0"
}
```

Use for:

- strategy config forms
- data import/backfill forms
- provider settings
- instrument config
- backtest parameter forms

### Rule

Financial inputs should always be validated at runtime with Zod, even if TypeScript types exist.

---

## 15. API Layer

```json
{
  "axios": "^1.7.0",
  "msw": "^2.4.0"
}
```

Use:

- Axios for HTTP API client
- TanStack Query for caching/refetching
- MSW for frontend development before backend endpoints are complete
- WebSocket/RxJS for live streams later

Recommended backend API direction:

```txt
FastAPI for Python HTTP/WebSocket API
OpenAPI schema generation
Generated TypeScript client when stable
```

---

## 16. Financial / Numerical Utilities

```json
{
  "numeral": "^2.0.0",
  "dinero.js": "^2.0.0",
  "date-fns": "^4.1.0",
  "date-fns-tz": "^3.2.0",
  "simple-statistics": "^7.8.0",
  "mathjs": "^13.2.0",
  "arquero": "^5.4.0",
  "lodash-es": "^4.17.0"
}
```

Use for:

- formatting prices/returns/P&L
- timezone-aware market sessions
- lightweight stats
- matrix/math utilities
- in-browser dataframe-style transforms
- safe utility functions

---

## 17. Testing & Quality

```json
{
  "vitest": "^2.1.0",
  "@testing-library/react": "^16.0.0",
  "@testing-library/user-event": "^14.5.0",
  "@vitest/coverage-v8": "^2.1.0",
  "playwright": "^1.48.0",
  "eslint": "^9.0.0",
  "@typescript-eslint/eslint-plugin": "^8.0.0",
  "@typescript-eslint/parser": "^8.0.0",
  "eslint-plugin-react-hooks": "^5.0.0",
  "prettier": "^3.4.0",
  "husky": "^9.1.0",
  "lint-staged": "^15.2.0"
}
```

Use:

- Vitest for unit tests
- Testing Library for components
- Playwright for critical workflows
- ESLint/Prettier for consistency
- Husky/lint-staged for pre-commit checks

---

## 18. Recommended Project Structure

```txt
q_frontend/
  src/
    app/
      App.tsx
      router.tsx
      providers.tsx

    assets/
      logos/
      videos/
      textures/
      icons/

    components/
      ui/
      layout/
      dock/
      charts/
      tables/
      background/

    scene/
      QuantScene.tsx
      environment/
      objects/
      postprocessing/
      theatre/

    workspaces/
      launcher/
      market-data/
      research/
      backtests/
      system/

    api/
      client.ts
      queries/
      schemas/

    store/
      slices/
      useAppStore.ts

    hooks/
    lib/
    types/
    styles/

    remotion/
      Root.tsx
      compositions/

    mocks/
      handlers.ts
      browser.ts

  src-tauri/
    tauri.conf.json
    src/

  tests/
    unit/
    e2e/
```

---

## 19. Phase Plan

### Phase 1 — Foundation

Build the real product shell first.

```txt
Tauri
React/Vite/TS
Router
Query client
Zustand store
Tailwind tokens
Launcher
Market Data workspace
System workspace
Basic charts/tables
Mock API via MSW
```

### Phase 2 — Backend integration

```txt
FastAPI q_backend API
Market data endpoints
Data lake status
Backfill controls
Instrument browser
OHLCV viewer
WebSocket event channel if needed
```

### Phase 3 — Premium visual layer

```txt
CSS/SVG Quant background
Motion-based dock interactions
Pre-rendered UE5 logo/background assets
Video loops where useful
```

### Phase 4 — Live 3D layer

```txt
R3F ambient scene
Particles
Wave terrain
Postprocessing
Theatre.js intro sequence
Leva tuning panel
Performance budget
```

### Phase 5 — Render/export system

```txt
Remotion compositions
Backtest summary videos
Strategy teardown exports
Portfolio review clips
```

---

## 20. Final Stack Summary

```txt
Desktop:        Tauri
UI:             React + Vite + TypeScript
Routing:        TanStack Router
Server state:   TanStack Query
Client state:   Zustand + Immer
Styling:        Tailwind + Radix + shadcn/ui
Animation:      motion
Live 3D:        React Three Fiber + Drei + Postprocessing
3D sequencing:  Theatre.js
Video export:   Remotion
Charts:         Recharts + D3/visx + Plotly
Tables:         TanStack Table + Virtual
Forms:          React Hook Form + Zod
API:            Axios + MSW + future generated client
Backend:        Python q_backend, likely FastAPI
Cinematic:      UE5 + Blender offline asset pipeline
Testing:        Vitest + Testing Library + Playwright
Quality:        ESLint + Prettier + Husky + lint-staged
```

## 21. Core Principle

Quant should feel cinematic, premium, and technically serious — but the application must remain maintainable, data-native, and fast.

Use **React/Tauri for the product**, **R3F for live lightweight 3D**, **Remotion for rendered data stories**, and **UE5/Blender for offline cinematic production**.
