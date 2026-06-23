# WO89 — Frontend: show entry AND exit strategy in Discovery results

## Shared context (read first)

Two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, `uv`. NEVER pip/poetry. (Not touched here.)
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, `pnpm`. NEVER npm.
  - Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`

**Context:** the Discovery (DISCOVER tab) results leaderboard shows only the **entry** strategy
name per row. The exit strategy is invisible — even when a candidate ran with an explicit exit
overlay, it surfaces only as a faint, truncated inline "Exit: …" chip that's easy to miss (and is
absent for entry-only runs). The user wants **both halves shown clearly** — entry and exit as
co-equal columns. This is the read-side companion to WO88 (which makes exits first-class on the
config side).

**Frontend-only.** The backend already serializes the exit labels
(`exit_preset_label`/`exit_policy_label`) on every candidate — no API change.

## How the pieces work today (read these files)

- `src/components/discover/LeaderboardTable.tsx` — the results table. Header columns are built from
  a `[key, label][]` list (`rank`, `strategy`, `objective`, `efficiency`, `trades`) rendered as
  sortable `<th>`, plus non-sortable `Gen?`, `Gate`, `Actions`. The Strategy cell (≈ line 242)
  renders `candidate.strategy` + an "Evolved" badge (`isGeneticCandidate`) + a faint inline
  `Exit: {candidateExitLabel(candidate)}` chip + `<ComplexityLine/>`. The expanded row uses
  `colSpan={showGenerationFilter ? 8 : 7}` and renders `<CandidateDetailPanel/>`.
- `src/lib/discover/exitInsights.ts` — `candidateExitLabel(candidate)` returns
  `exit_preset_label ?? exit_policy_label ?? null`. Also `hasExitInsight`, `resolveExitQuality`.
- `src/types/strategySearch.ts` — `CandidateResult` already carries `exit_preset_id/label`,
  `exit_policy_id/label`, `strategy`, `genome`.
- `src/components/discover/CandidateDetailPanel.tsx` — expanded view; already includes
  `<ExitInsightPanel/>`. Leave its content; just keep it consistent with the new column.

## Goal

```
Rank │ Entry              │ Exit              │ OOS Net profit │ … │ Gate
  1  │ MACrossover Evolved│ ATR Stop + Target │ 747            │   │ PASSED
  –  │ DonchianBreakout   │ Signal exit       │ 24,997         │   │ FLAGGED
```

Every row reads as intentional: an explicit exit shows its label; an entry-only candidate shows a
muted **"Signal exit"** (it closes via the strategy's own signal logic, not an SL/TP overlay).

## Tasks

### 1. Add an `Exit` column; rename `Strategy` → `Entry` (`LeaderboardTable.tsx`)

- Rename the `strategy` column header label from `Strategy` to **`Entry`** (keep `key: 'strategy'`
  and its existing sort behavior).
- Add a new **non-sortable** `Exit` `<th>` immediately after `Entry` (mirror the `Gate`/`Actions`
  plain-`<th>` pattern — not part of the sortable `[key,label]` list).
- Add the matching `<td>` in the body row, after the Entry cell, rendering
  `candidateExitDisplayLabel(candidate)` (Task 3). Style it like the other secondary cells
  (`text-silver-300`, small). When the value is the "Signal exit" fallback, render it muted
  (`text-silver-500`) with a `title` explaining "Closes on the strategy's own signal — no
  stop/target overlay."
- Bump the expanded row `colSpan` by 1 (`showGenerationFilter ? 9 : 8`).

### 2. Remove the inline `Exit:` chip from the Entry cell

Delete the faint `Exit: {candidateExitLabel(candidate)}` span (now redundant with the column).
Keep `candidate.strategy`, the "Evolved" badge, and `<ComplexityLine/>`.

### 3. Display-label helper (`exitInsights.ts`)

Add `candidateExitDisplayLabel(candidate): { label: string; explicit: boolean }`:

- if `candidateExitLabel(candidate)` is non-null → `{ label, explicit: true }`;
- else → `{ label: 'Signal exit', explicit: false }`.
  Keep `candidateExitLabel` as-is (other callers may rely on null).

## Guardrails

> Frontend-only — no API/type changes (fields already exist).
> Do not change sorting/filtering logic beyond adding the non-sortable column and the header
> rename. The `colSpan` bump must match the new column count or the expanded panel misaligns.
> Keep `CandidateDetailPanel`/`ExitInsightPanel` behavior unchanged.

## Tests

- `src/components/discover/__tests__/LeaderboardTable.test.tsx`:
  - header renders `Entry` and `Exit`; `Strategy` no longer present;
  - a candidate with `exit_preset_label` shows that label in the Exit cell;
  - a candidate with only `exit_policy_label` shows the policy label;
  - an entry-only candidate (both null) shows the muted "Signal exit";
  - the inline `Exit:` chip is gone from the Entry cell;
  - expanding a row still renders `CandidateDetailPanel` spanning the full (now +1) width.
- `src/lib/discover/__tests__/exitInsights.test.ts`: `candidateExitDisplayLabel` returns
  `explicit:true` with the preset label, prefers preset over policy, and falls back to
  `{ 'Signal exit', explicit:false }`.

## Definition of done

- `pnpm test:run` and `pnpm exec tsc -p tsconfig.app.json --noEmit` and `pnpm build` all pass —
  **do not report completion until they do.**
- Paste-in-final-message: confirm the leaderboard shows distinct Entry and Exit columns, entry-only
  rows read "Signal exit", and explicit-overlay rows show their preset/policy label.

## Out of scope

- Backtests config exit cards — **WO88**.
- Describing the _specific_ intrinsic exit per registry strategy (e.g. "opposite cross") — the
  "Signal exit" label is sufficient; richer per-strategy exit descriptions are a later follow-up.
- Any change to what discovery searches (exit search bounds live in WO87).
