# Q-110 implementation plan: Figures tab in the Research workspace

> **For implementation agents:** Read the linked specification and repository instructions. Launch only through `./work start Q-110 --agent <agent> --worktree` after written-plan approval and completed dependencies. Implement natively; delegation requires separate authorization.

**Goal:** The Research workspace opens on a Figures tab that shows the figures research scripts publish, within seconds of publication.
**Architecture:** A polled list query feeds a collections rail, a card grid and a viewer; images load straight from the content route and Plotly figures render through a lazily loaded `plotly.js-dist-min` chunk.
**Tech stack:** React 19, TypeScript, TanStack Query and Router, MSW, Vitest and Testing Library, `plotly.js-dist-min`.
**Spec:** [Specification](../specs/Q-110-figures-tab-in-the-research-workspace-spec.md)
**Status:** written plan awaiting human review.

## Global constraints

- Never hand-edit vendored contract code; use `make contracts`.
- Plotly is imported only through a dynamic import inside the Plotly figure component, pinned to the major version that pairs with the Plotly release Q-109 added to `q_backend`.
- SVG is displayed only through `<img>`.
- Reuse the shared UI primitives and the existing reduced-motion and fullscreen hooks.
- Tests run as `TZ=America/Sao_Paulo pnpm test:run` against MSW. No backend or Tauri run.
- Commit focused units on the task branch; no push, merge or protected-branch checkout.

## Review focus

- The default tab changes in the route parser, the route component and the workspace prop together; deep links to the other tabs still work.
- Polling runs only while the tab is mounted and the document is visible, and a poll that returns unchanged data re-renders nothing.
- Every mounted Plotly plot is purged on unmount; scrolling a long grid does not accumulate plots.
- A replaced figure never shows stale content, in a card or in the open viewer.
- The viewer is keyboard-operable and returns focus to the card it was opened from.

## Ordered implementation

### 1. Contract, types, queries and mocks

**Files:** `CONTRACTS_REV` and `make contracts`; new `src/types/researchFigures.ts`, `src/api/queries/researchFigures.ts`, `src/mocks/researchFigures.ts`; modify `src/mocks/handlers.ts`; extend `src/api/queries/__tests__/`.

- [x] Add failing query tests: list with `collection`, paging, delete, bulk delete, the content URL with revision, and polling gated on visibility.
- [x] Implement types, queries and MSW fixtures (PNG, SVG, Plotly; two collections; one missing content).
- [x] Run `make contracts-check` and the query tests; commit.

### 2. Tab and routing

**Files:** `src/types/features.ts`, `src/app/router.tsx`, `src/app/__tests__/researchRoute.test.ts`, `src/workspaces/research/ResearchWorkspace.tsx` and its test.

- [x] Add failing tests for spec acceptance item 1 and the `figure` search parameter.
- [x] Add the tab first, change the default, parse `figure`, update the description; commit.

### 3. Grid, rail and image figures

**Files:** new components under `src/components/research/figures/` with tests.

- [x] Add failing tests for spec acceptance items 2, 3, 5, 7 and 8.
- [x] Implement the rail, the grid with filter and paging, image cards, the New/Updated marks, deletion and the states; commit.

### 4. Plotly figures

**Files:** `package.json`, `pnpm-lock.yaml`, a `PlotlyFigure` component and its test under `src/components/research/figures/`.

- [x] Add failing tests for spec acceptance item 4 with the Plotly module mocked.
- [x] Add the dependency, the lazy loader, in-view mounting, purge, resize and PNG download; commit.

### 5. Viewer

**Files:** a `FigureViewer` component and its test.

- [x] Add failing tests for spec acceptance item 6.
- [x] Implement the viewer, keyboard navigation, focus return, fullscreen, fit and actual size, and live reload on revision change; commit.

## Verification

- `pnpm lint`, `pnpm typecheck`, `TZ=America/Sao_Paulo pnpm test:run`, `pnpm build` and `make contracts-check`.
- Browser check of the MSW web preview at desktop and narrow widths: grid, viewer keyboard use, Plotly interaction and reduced motion. Keep screenshots and temporary scripts outside the repository.
- Review the whole change, then `./work board set Q-110 in-review` with results and remaining limitations.
