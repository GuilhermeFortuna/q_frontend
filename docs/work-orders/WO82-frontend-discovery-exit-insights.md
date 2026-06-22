# WO82 — Frontend: Discovery exit-insight panels

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`

**Context for this work:** WO79 and WO80 make exit logic a first-class Discovery dimension, and WO81
adds backend `exit_quality` diagnostics. The Discover workspace should surface these results so a
researcher can answer: "Is this strategy interesting because of the entry, the exit, or the
entry/exit combination?" This WO is frontend-only and must degrade cleanly against pre-WO79/WO81
backends where exit metadata is absent.

---

## How the pieces work today (read these files)

- `src/types/strategySearch.ts`
  - `CandidateResult`, `StrategySearchResults`, genetic metadata types.
- `src/components/discover/DiscoverResultsPanel.tsx`
  - top-level results rendering.
- `src/components/discover/LeaderboardTable.tsx`
  - candidate rows and sorting.
- `src/components/discover/CandidateDetailPanel.tsx`
  - candidate detail, genome viewer, promote-to-backtest/optimizer actions.
- `src/components/discover/GenomeViewer.tsx`
  - current genetic explanation UI.
- `src/lib/discover/promoteCandidate.ts`
  - candidate promotion payloads.
- `src/mocks/strategySearch.ts` and `src/mocks/handlers.ts`
  - mock strategy search payloads.
- Tests to read/extend:
  - `tests/unit/components/LeaderboardTable.test.tsx`
  - `tests/unit/lib/promoteCandidate.test.ts`
  - existing Discover component tests.

---

## Goal

Candidate detail shows exit intelligence when available:

```text
Exit Policy
ATR stop + Chandelier trail

Exit Distribution
fixed_sl       12 trades   -4,200
chandelier     19 trades   +15,750
signal         11 trades   +2,100

Path Quality
MFE captured 47%
Avg giveback 310
Median hold 8 bars
```

Leaderboard rows can show an unobtrusive exit tag for exit-expanded candidates, but the existing
leaderboard must remain usable when the backend sends no exit metadata.

## Tasks

### 1. Types

Extend `src/types/strategySearch.ts` additively:

```ts
export type ExitQualitySummary = {
  total_closed_trades?: number
  by_reason?: Record<
    string,
    {
      trades: number
      total_pnl?: number | null
      win_rate?: number | null
      avg_pnl?: number | null
    }
  >
  holding_period?: {
    median_bars?: number | null
    p90_bars?: number | null
    median_minutes?: number | null
  }
  path_quality?: {
    avg_mfe_capture_ratio?: number | null
    avg_profit_giveback?: number | null
    avg_mae?: number | null
  }
}
```

Add optional fields on `CandidateResult` or `candidate.metadata` depending on the backend contract:

- `exit_preset_id`
- `exit_preset_label`
- `exit_policy_id`
- `exit_policy_label`
- `exit_quality`

All fields optional.

### 2. Candidate detail panel

Add an `ExitInsightPanel` under the existing candidate detail summary:

- Shows preset/policy label when present.
- Shows exit reason distribution sorted by `total_pnl` desc, with trade count and win rate.
- Shows holding period and path-quality stats only when non-null.
- Empty/degraded state: render nothing when no exit metadata exists.

Keep this operational, not decorative. Do not add a marketing/explainer section.

### 3. Leaderboard exit tags

In `LeaderboardTable`, add a compact exit tag for candidates with exit preset/policy metadata:

```text
Exit: Chandelier
Exit: Donchian trail
```

Do not add a new default sort unless backend provides a stable scalar. The table must not become
wider than the current layout on small screens; hide or wrap the tag if needed.

### 4. Promotion behavior

When promoting a candidate to Backtest/Optimizer:

- Preserve `best_params` as today.
- Preserve genome as today for genetic candidates.
- Do not include frontend-only diagnostic fields in `strategy_params`.
- If backend includes explicit exit preset params in `best_params`, they naturally flow through.

Add tests so exit metadata does not pollute promoted payloads.

### 5. Mocks

Update `src/mocks/strategySearch.ts` with at least:

- one registry exit-preset candidate,
- one genetic exit-policy candidate,
- one candidate with no exit metadata.

## Guardrails

> **Pre-backend compatibility.** Missing `exit_quality` / exit labels must render the current UI
> without errors.

> **Diagnostics stay diagnostics.** Do not change candidate ranking or promote payload semantics in
> the frontend.

> **No nested cards inside cards.** Keep the detail panel consistent with the existing Discover UI.

> **No in-app tutorial copy.** Labels and metrics are enough; avoid explanatory paragraphs about how
> Discovery works.

## Tests

- Types/mock payloads validate with optional exit fields.
- `CandidateDetailPanel`:
  - renders exit preset label and reason distribution.
  - omits the panel when metadata is missing.
  - formats null path-quality values without `NaN`.
- `LeaderboardTable`:
  - renders compact exit tag for exit-expanded candidates.
  - still renders old candidates.
- `promoteCandidate`:
  - exit diagnostic fields do not enter `strategy_params`.
  - explicit backend `best_params` exit params still pass through.

## Docs

`q_frontend/README.md`: update the Discover workspace bullet to mention exit insights when backend
candidate diagnostics are available.

---

## Definition of done

- `pnpm test:run`, `pnpm exec tsc -p tsconfig.app.json --noEmit`, and `pnpm build` pass. **Do not
  report completion until all three pass.**
- Discover candidate details show exit metadata when present and degrade cleanly when absent.
- Final message must paste:
  - the optional type fields added,
  - which UI locations render exit insight,
  - confirmation that promote payloads are unchanged except for real backend `best_params`.

## Out of scope

- Backend exit-preset expansion — WO79.
- Backend genetic exit-policy mutation — WO80.
- Backend exit-quality computation — WO81.
