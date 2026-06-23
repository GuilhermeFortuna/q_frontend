# WO105 — Frontend: fix virtualized table/list layout and key correctness

## Shared context (read first)

Frontend-only WO. Use `pnpm`, never `npm`.

Depends on **WO100**.

**Review finding:** the virtual table helper renders each virtual row as a nested absolute `<table>`
inside one `colSpan` cell. That can break header/body column alignment, variable-height expanded
rows, and semantic table layout. The list helper also emits React key warnings below the
virtualization threshold.

## Goal

Make virtualization correct before Q’s result surfaces grow:

- table headers and body columns stay aligned;
- expanded leaderboard details do not overlap or disappear;
- non-virtual list rendering has stable keys;
- virtualized and non-virtual rows look identical;
- large fixtures keep DOM size bounded.

## How the pieces work today

Read:

- `src/components/shared/VirtualTableBody.tsx`
- `src/components/shared/VirtualListScroller.tsx`
- `src/hooks/useVirtualList.ts`
- `src/components/discover/LeaderboardTable.tsx`
- `src/components/optimize/TrialsTable.tsx`
- `src/components/walkforward/WalkForwardWindowsTable.tsx`
- `src/components/backtests/BacktestResultsTabs.tsx`
- `src/components/backtests/BacktestHistoryPanel.tsx`
- `tests/unit/components/VirtualTableScroller.test.tsx`
- `tests/unit/components/LeaderboardTable.test.tsx`

## Tasks

### 1. Fix list keys

In `VirtualListScroller`, wrap non-virtual `items.map` output in a keyed element or require
`renderItem` to return a keyed element consistently.

Prefer using `getItemKey?.(index) ?? index` in the helper so call sites do not need to remember it.

### 2. Rework table virtualization semantics

Replace the nested-per-row-table approach with one of these stable patterns:

- a single table with virtual spacer rows and translated row groups;
- CSS grid/flex row virtualization with explicit column templates shared by header/body;
- a documented `display: grid` table replacement for surfaces that need variable-height expansion.

Whichever approach is chosen must preserve:

- sticky headers;
- horizontal overflow;
- row hover/selection styling;
- keyboard/focus behavior where present;
- expanded Discovery candidate detail rows.

### 3. Handle variable-height rows

Leaderboard expansion renders multiple rows and can be much taller than the collapsed row.

Use `measureElement`, explicit estimated sizes, or a separate non-virtual detail panel pattern so
expanded rows do not overlap. Add tests that expand a row after virtualization is active.

### 4. Strengthen tests

Add large-fixture tests for:

- bounded DOM row count;
- header/body column count or layout contract;
- expanding a virtualized leaderboard row;
- non-virtual list branch has no key warnings.

If JSDOM cannot validate visual alignment, add a small Playwright smoke or document manual checks.

## Visual guardrails

> Virtualized rows must be visually indistinguishable from non-virtual rows.

> Do not remove detail richness or expansion affordances to make virtualization easier.

## Tests

- `pnpm test:run -- tests/unit/components/VirtualTableScroller.test.tsx tests/unit/components/LeaderboardTable.test.tsx`
- `pnpm test:run -- tests/unit/workspaces/BacktestsWorkspace.test.tsx`
- `pnpm test:run`
- `pnpm exec tsc -p tsconfig.app.json --noEmit`
- `pnpm build`

## Manual verification

With large mocked or real datasets:

- scroll Discovery leaderboard, optimization trials, walk-forward windows, and trade history;
- expand a Discovery candidate near the top, middle, and bottom of the list;
- verify sticky headers align with body columns;
- verify no React key warnings in console.

## Definition of done

- No key warning from `VirtualListScroller`.
- Virtualized tables preserve alignment and expansion behavior.
- Large fixtures prove bounded DOM size.
- Manual visual checks pass.
- Required test/typecheck/build commands pass.

## Out of scope

- Backend pagination.
- Changing table data contracts.
- Removing row expansion/detail panels.
