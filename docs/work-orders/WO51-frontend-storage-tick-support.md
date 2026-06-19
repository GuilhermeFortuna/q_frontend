# WO51 — Frontend: Tick download + inventory in the Storage workspace

## Shared context (read first)

You are working in a two-repo project. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Typecheck/lint: `pnpm lint` (check `package.json` for exact names)

**Context for this batch ("Local Data Store"):** the Storage workspace (WO49) lets the user
download **OHLCV bars** from MT5 into a portable local parquet store and browse what's stored;
WO50 added **tick** ingestion + a `local` tick reader on the backend (catalog rows now carry a
`kind` of `"bars"` or `"ticks"`). This work order surfaces ticks in the existing Storage UI.
**The tick request `kind:"ticks"` and the catalog/inventory `kind` field are pasted in WO50's
completion message — build against that.** This work order is **frontend only.**

**Prerequisites shipped:** WO49 (Storage workspace), WO50 (tick backend + `kind` field).

---

## How the frontend works today (read these files)

- `src/workspaces/storage/StorageWorkspace.tsx` (WO49) — the download form (with the
  bars/ticks toggle already present but **ticks disabled**) and the inventory table. You enable
  ticks and make both regions kind-aware.
- `src/api/queries/storage.ts` + `src/types/storage.ts` (WO49) — `IngestRequest` already has a
  `kind` field; `StorageInventoryItem` gains `kind` (mirror WO50's shape).
- `src/mocks/storage.ts` (WO49) — extend with tick inventory rows and a tick ingest job.
- The timeframe multi-select in the download form — for `kind:"ticks"`, timeframe is
  irrelevant; hide/disable the timeframe control when Ticks is selected.

---

## Goal

The user can download ticks (not just bars) and see tick datasets in the inventory, clearly
distinguished from bars — with honest warnings about size.

## Tasks

1. **Enable the Ticks toggle** in the download form. When **Ticks** is selected: hide/disable
   the timeframe multi-select (ticks have no timeframe), keep symbol + date range, and submit
   `kind:"ticks"` (timeframes omitted/empty). Show an inline caution that tick ranges are large
   and ingest slowly — suggest narrow ranges. Reuse the existing progress flow unchanged (the
   job status is kind-agnostic; `detail` carries per-month progress from WO50).
2. **Kind in the inventory table** — add a "Kind" column (Bars / Ticks badge). Tick rows show a
   `—` for timeframe. Delete uses the same endpoint; confirm dialog mentions kind. Verify the
   delete query key/path matches how WO48/WO50 key bars vs ticks (a tick dataset is per-symbol,
   not per-timeframe — adjust the delete call/types accordingly per WO50's contract).
3. **Types** — extend `StorageInventoryItem` with `kind: "bars" | "ticks"` and make timeframe
   optional for ticks. Keep `isIngestTerminalStatus` etc. as-is.
4. **Mocks** — add a tick inventory row and a `kind:"ticks"` ingest job (progresses to
   completed) to `src/mocks/storage.ts`.
5. **Tests** — selecting Ticks hides the timeframe control and submits `kind:"ticks"`; the
   inventory renders the Kind badge and a tick row with no timeframe; deleting a tick dataset
   calls the correct endpoint.

---

## Definition of done

- `pnpm test:run` and `pnpm lint` pass. **Do not report completion until they do.**
- Against a live backend (WO50): download ticks for a narrow range on Windows, watch per-month
  progress, see the tick dataset appear in inventory with the Ticks badge, delete it; then with
  data-source `Local` confirm a tick backtest runs offline (manual end-to-end check).
- The bars flow from WO49 is unchanged for `kind:"bars"`.

## Out of scope

- Backend changes (WO50 owns tick ingestion + reader). Re-deriving bars from stored ticks.
- Any new System-page behavior beyond what WO47/WO49 shipped.
