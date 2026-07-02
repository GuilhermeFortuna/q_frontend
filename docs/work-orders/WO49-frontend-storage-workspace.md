# WO49 — Frontend: Storage workspace + System data-source card

## Shared context (read first)

You are working in a two-repo project. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Typecheck/lint: `pnpm lint` (check `package.json` for exact names)

**Context for this batch ("Local Data Store"):** the app is being made runnable on **Linux**
without MT5 by reading market data from a **portable local parquet store** filled on Windows
from MT5. The backend now has a provider router (`auto`/`mt5`/`local`, WO47) and an OHLCV store
with a Storage API — download-from-MT5 job, inventory, delete (WO48). **The exact JSON
contracts (`GET/PUT /system/data-source`, the four `/storage/*` endpoints, the inventory/job
shapes) are pasted in WO47's and WO48's completion messages — build against those, not
guesses.** This work order is **frontend only**: a new **Storage** workspace (download +
inventory) and a **Data Source** card on the System page. Ticks are not in the UI yet (WO51).

**Prerequisites shipped:** WO47 (system data-source endpoints), WO48 (storage endpoints).

---

## How the frontend works today (read these files)

- `src/types/api.ts` — `WorkspaceId` union (~line 1). Extend it with `'storage'`. Also holds
  `SystemHealth`, `OhlcvAvailableRange` etc. — add storage/data-source types near these.
- `src/app/router.tsx` — route table. Mirror `marketDataRoute`/`systemRoute`: add
  `storageRoute` (`path: '/storage'`, `beforeLoad: () => syncWorkspace('storage')`,
  `component: StorageWorkspace`) and add it to `routeTree.addChildren([...])`.
- `src/components/dock/AppDock.tsx` — the workspace dock `items` array (~line 27). Add
  `{ id: 'storage', label: 'Storage', to: '/storage', icon: Database, enabled: true }`
  (import `Database` from `lucide-react`). Place it logically (near `market-data`/`system`).
- `src/workspaces/system/SystemWorkspace.tsx` — the System page. Add a **Data Source** card
  here; reuse the `presetButton*` segmented-control styles defined at the top of this file and
  the `Card`/`CardHeader`/`CardContent` components it already imports. It already calls
  `useSystemHealth()` — extend or add a query for the data-source endpoint.
- `src/api/queries/system.ts` — `useSystemHealth`. Add `useDataSource()` (GET) and a
  `useSetDataSource()` mutation (PUT) here, following the existing query/axios style.
- `src/api/queries/market-data.ts` — `useSearchSymbols` (reuse for the symbol picker in the
  download form). `src/api/client.ts` is the axios instance.
- `src/components/shared/InstrumentConfigFields.tsx` and
  `src/components/market/SymbolCommandPalette.tsx` — existing symbol/instrument inputs to reuse
  rather than re-inventing a symbol field.
- `src/components/tables/` and the card styling used across workspaces — for the inventory
  table. Match the visual language (carbon/brass/silver classes) used in `SystemWorkspace.tsx`.
- Polling pattern: any workspace that drives a background job (e.g.
  `src/api/queries/walkforward.ts` / `optimize.ts`) shows how to poll a job-status query while
  running and stop on a terminal status. Clone that for the ingest job.
- `src/mocks/` — MSW handlers (tests + `enableMsw` run against these). Add
  `src/mocks/storage.ts` (and a `system` data-source handler) following an existing mock file.

---

## Goal

A **Storage** workspace where the user, on Windows, downloads OHLCV data from MT5 into the local
parquet store and sees what's stored; and a **Data Source** control on System to switch the app
between MT5 and the local store.

## Tasks

### 1. Register the workspace

- Add `'storage'` to `WorkspaceId` (`types/api.ts`).
- Add `storageRoute` to `router.tsx` and into the route tree.
- Add the dock entry in `AppDock.tsx`.
- Create `src/workspaces/storage/StorageWorkspace.tsx`.

### 2. Storage query module + types

- `src/types/storage.ts` (or add to `types/api.ts`): `StorageInventoryItem`
  (`symbol, timeframe, start, end, rows, bytes, updatedAt`), `IngestRequest`
  (`symbol, timeframes[], start, end, kind`), `IngestJob` (`jobId, status, progress, detail,
  results, error`), plus an `isIngestTerminalStatus` helper. **Match WO48's pasted shapes.**
- `src/api/queries/storage.ts`: `useStorageInventory()` (GET inventory),
  `useStartIngest()` (POST), `useIngestStatus(jobId)` (GET, polls while running, stops on
  terminal — mirror the walk-forward status hook), `useDeleteStorage()` (DELETE; invalidate
  inventory on success).

### 3. Storage workspace UI

`StorageWorkspace.tsx`, two regions (match the workspace shell + card style):

- **Download panel** — a form: symbol (reuse `useSearchSymbols` + the shared instrument field),
  **timeframe multi-select** (the accepted names — reuse the timeframe list the optimize/
  backtest forms use), start/end date range, and a (disabled-for-now) bars/ticks toggle showing
  only **Bars** active (ticks land in WO51). "Download" → `useStartIngest`; while a job runs,
  show a **progress bar** driven by `useIngestStatus(jobId)` with the per-timeframe `detail`,
  and on completion refresh the inventory. If the backend reports MT5 unavailable
  (`mt5_available:false` from the data-source/health query), disable Download with an inline
  note ("Downloading needs MT5 — run this on the Windows machine").
- **Inventory table** — columns: Symbol · Timeframe · Range (start→end) · Rows · Size (format
  `bytes` human-readable) · Updated · Delete. Source: `useStorageInventory`. Delete →
  `useDeleteStorage` with a confirm. Empty state explains the store is empty / how to download.

### 4. System — Data Source card

In `SystemWorkspace.tsx`, add a card above or beside "Backend health":

- Title "Data Source", description e.g. "Choose where market data comes from. Auto uses
  MetaTrader 5 when available, otherwise the local parquet store."
- A segmented control `Auto / MT5 / Local` (reuse `presetButton*` styles) bound to
  `useDataSource()` + `useSetDataSource()`.
- A read-only status line: `MT5 available: yes/no` and `Active provider: mt5/local` (from the
  data-source GET payload). When `Local` is selected and MT5 is unavailable, this is the normal
  Linux state — present it calmly, not as an error.

### 5. Mocks

- `src/mocks/storage.ts`: inventory (a couple of sample items), ingest (returns a job id;
  status progresses queued→running→completed over a few polls), delete. Wire it into the mock
  worker setup the same way other handler modules are registered.
- Add a `/system/data-source` GET/PUT mock (default `auto`, `mt5_available:false`,
  `active_provider:"local"` so the Linux state is exercised) and extend the health mock with the
  two new fields so `SystemWorkspace` renders under MSW.

### 6. Tests

- Storage workspace (MSW): renders inventory rows; starting a download shows progress and, on
  the mocked completion, refreshes inventory; delete removes a row.
- System Data Source card: reflects the mocked source, switching calls PUT and updates the
  active-provider line; with `mt5_available:false`, Download in Storage is disabled.
- Typecheck/lint clean; the dock shows the Storage entry and the route resolves.

---

## Definition of done

- `pnpm test:run` and `pnpm lint` pass. **Do not report completion until they do.**
- The Storage workspace and System Data Source card work against **both** MSW mocks and a live
  backend (WO47+WO48). On Windows: download a symbol, watch progress, see it in inventory,
  delete it. Flip Data Source to `Local` and confirm the app reads the store.
- The UI degrades cleanly when MT5 is unavailable (download disabled with a note; no error
  walls) — the Linux-target state.
- In your final message, note any backend contract mismatch you had to work around, and confirm
  the timeframe list used matches the backend's accepted names.

## Out of scope

- Tick download/inventory in the UI (WO51) — keep the bars/ticks toggle present but ticks
  disabled.
- Changing live Market-terminal behavior beyond what the data-source switch already implies.
- Any backend change (WO47/WO48 own the API).
