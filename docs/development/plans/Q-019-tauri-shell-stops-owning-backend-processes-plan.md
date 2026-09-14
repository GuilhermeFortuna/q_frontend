# Q-019 implementation plan: Tauri shell stops owning backend processes

**Status:** authoritative in the [Q project board](https://github.com/users/GuilhermeFortuna/projects/2)  
**Specification:** [`../specs/Q-019-tauri-shell-stops-owning-backend-processes-spec.md`](../specs/Q-019-tauri-shell-stops-owning-backend-processes-spec.md)  
**Depends on:** Q-018

## Current-system context

`src-tauri/src/backend.rs` (448 lines) holds `BackendState` (two
`Mutex<Option<Child>>`), `resolve_backend_dir`, which walks up to eight parents
of the executable looking for `q_backend` with `docker-compose.yml`,
`pyproject.toml`, and `docker/metatrader5-stub`, and then tries
`resource_dir/_up_/_up_/q_backend`. It also holds the `ComposeRuntime` detection
(`QUANT_CONTAINER_RUNTIME`), `start_compose_services`, `check_uv_installed`,
`sync_dependencies`, `run_migrations`, `load_env_file`, which copies the backend
`.env.example` into the app data directory, `kill_child_tree`, and
`start_backend_services` / `stop_backend_services`. `QUANT_EXTERNAL_BACKEND=1`
skips all of it. `src-tauri/src/lib.rs` manages `BackendState`, calls
`start_backend_services` in `setup`, shows a blocking dialog, and calls
`handle.exit(1)` on failure. It calls `stop_backend_services` on
`RunEvent::Exit`. `report.rs` is independent and uses `tauri_plugin_dialog` for
its save dialog. `tauri.conf.json` bundles eight `../../q_backend/…` resources.
`package.json` has `tauri:dev:docker` → `scripts/tauri-dev-docker.js`, which
starts compose from the monorepo root. `docs/dev/gateway-app-wide-validation.md`
line 8 links `../../q_backend/docs/mt5-wine-gateway.md`. The README's
"transition from mock data" section tells the user to run compose, alembic,
uvicorn, and the worker by hand. In `q_backend`, `README.md` lines 130, 156, 267,
and 963 link `../q_frontend/docs/design/…`.

On the web side, `src/lib/env.ts` exposes `apiBaseUrl` (default
`http://127.0.0.1:8000`), `enableMsw`, and `enableStream`.
`src/api/queries/system.ts::useSystemHealth` polls `/api/v1/system/health`
every 60 s. It is typed with the hand-written `SystemHealth` in
`src/types/api.ts`, which lacks `storageStatus`, while the vendored
`contracts/api.ts` has `SystemHealthResponse` with `storageStatus:
StorageStatusResponse`. `AppShell.tsx` renders `LiveUpdatesIndicator` (Q-016),
which shows "Live updates unavailable" when the stream is down. Q-016 added a
test that fails if stream frame types are redeclared under `src`. No component
reports whether the API itself is reachable. When it is not, each surface shows
its own `OperationalFailureState`. The gap is that the shell owns the backend's
lifecycle, and the UI has no single, honest backend status to show once it
stops.

## Interfaces produced

```rust
// src-tauri/src/lib.rs  (changed)
// removed: mod backend; .manage(BackendState); start/stop_backend_services calls; setup failure dialog
pub fn run();                                   // tray, window events, report command, Sentry unchanged

// src-tauri/src/backend.rs                     deleted
// src-tauri/tests/no_process_ownership.rs
#[test] fn shell_source_spawns_no_processes();  // scans src-tauri/src for forbidden tokens
```

```jsonc
// src-tauri/tauri.conf.json  (changed)
"bundle": { "resources": [] /* key removed */ }
```

```ts
// src/lib/backend/connectionStatus.ts
import type { SystemHealthResponse } from '../../../contracts/api'   // relative, as in api/queries/backtests.ts

export type BackendConnection =
  | { state: 'mocked' }
  | { state: 'connected'; health: SystemHealthResponse }
  | { state: 'degraded'; health: SystemHealthResponse; failing: Array<'postgres' | 'redis'> }
  | { state: 'offline'; apiBaseUrl: string; nextRetryMs: number; since: number }

export const BACKEND_START_COMMAND = 'systemctl --user start q-backend.target'
export function retryDelayMs(attempt: number): number   // 1000 * 2^attempt, capped at 30_000
export function classifyHealth(health: SystemHealthResponse): BackendConnection

// src/api/queries/backendConnection.ts
export function useBackendConnection(): BackendConnection

// src/components/layout/BackendStatusIndicator.tsx
export function BackendStatusIndicator(): JSX.Element  // rendered in AppShell next to LiveUpdatesIndicator
```

```js
// scripts/check-cross-repo-paths.mjs
// exit 1, listing file:line, when a tracked file (git ls-files) contains a relative
// path into a sibling repository: (\.\./)+(q_backend|q_contracts|q_core|q_terminal)\b
```

```python
# q_backend: tests/test_no_cross_repo_paths.py
def test_no_relative_links_into_sibling_repositories() -> None: ...
```

```
package.json            removed script "tauri:dev:docker"; ci.sh step runs check-cross-repo-paths
scripts/tauri-dev-docker.js                               deleted
docs/dev/gateway-app-wide-validation.md                   link pinned to a q_backend commit URL
README.md                                                 backend section points to the q_backend systemd units doc (pinned URL)
q_backend: README.md                                      four links pinned to a q_frontend commit URL
tests/unit/layout/BackendStatusIndicator.test.tsx
tests/unit/lib/backend/connectionStatus.test.ts
tests/unit/api/backendConnection.test.ts
tests/unit/scripts/checkCrossRepoPaths.test.ts
```

## Implementation decisions

- **`backend.rs` is deleted outright, not gated behind a flag.** Keeping
  `QUANT_EXTERNAL_BACKEND` inverted, as an opt-in to the old behavior, would keep
  invariant 8 violable by one environment variable and keep 448 lines of
  untested process code. Q-018's units are the only supported way to run the
  backend.

- **The Rust test scans `src-tauri/src` for `std::process`, `Command::new`,
  `compose`, `alembic`, `"uv"`, `podman`, `docker`, and the two removed variables,
  and fails on any match.** A reintroduced spawn would compile, pass every
  existing test, and only show up as a backend that dies when the window closes.
  A source scan is crude, but it is exact for this invariant, and it runs in
  `cargo test` with no GUI.

- **The status is computed in React from the existing health endpoint, not in
  the Rust shell.** Browser mode and the desktop app must agree (spec), and MSW
  and Vitest can drive a React hook but not a Tauri command. The shell has
  nothing to add, because it no longer knows anything about the backend that the
  web view does not.

- **`useBackendConnection` is a separate React Query query on the same key
  family as `useSystemHealth`, with `retry: false` and a `refetchInterval` of
  `retryDelayMs(failureCount)` while offline and 60 s while connected or
  degraded.** React Query's own `retry` backoff applies per fetch and resets on
  every interval tick, so it cannot give a 1-to-30-second backoff that
  continues across ticks. Driving the interval from the query's
  `errorUpdateCount` does. Sixty seconds while healthy matches today's
  `useSystemHealth`, so a running backend sees no extra load.

- **On the transition from offline to connected, the hook calls
  `queryClient.invalidateQueries()` once, excluding its own key.** Surfaces that
  failed during the outage otherwise stay in their error state until their own
  next interval or a user action, and many research queries have no interval.
  One invalidation on recovery is the "recover on their own" requirement, and
  it is bounded to one refetch wave per outage.

- **Health types come from the vendored `contracts/api.ts` `SystemHealthResponse`. The
  hand-written `SystemHealth` is left in place for the System workspace, and a
  test fails if a type with a `storageStatus` field is declared under `src`.**
  Invariant 2 forbids hand-written mirrors, and the hand-written type already
  lacks `storageStatus`, which is exactly the field the Degraded state needs.
  Migrating the System workspace's type is a separate cleanup, and the test keeps
  new code from adding another mirror. This follows Q-016's stream-types
  precedent.

- **Degraded is decided only from `storageStatus.postgres` and
  `storageStatus.redis`, not from the top-level `status` or `mt5_available`.**
  The backend sets `status: "degraded"` whenever MT5 is not connected, which on
  Linux is every weekend and every evening. A research UI that shows Degraded
  whenever the market is closed trains its user to ignore the indicator.
  Market-data source state is already shown in the System workspace.

- **The offline status names `systemctl --user start q-backend.target` as a
  copyable command, and nothing runs it.** The spec rules out service control from
  the UI. The command string is a constant, checked against Q-018's handoff
  report, so it names the target that actually exists.

- **Mock mode short-circuits to `{ state: 'mocked' }` without registering the
  query.** MSW would otherwise answer the health request with a fixture, and the
  indicator would claim a healthy backend that does not exist. Q-016 disables the
  stream in mock mode for the same reason.

- **The setup failure dialog and `handle.exit(1)` are removed with no
  replacement dialog.** §8.1 specifies an offline state for `q_frontend` when the
  API is unavailable, not a refusal to start. A modal at launch would be the
  "error wall" §8.1 rules out.

- **`tauri-plugin-dialog` and `tauri-plugin-shell` stay.** `report.rs` uses the
  dialog plugin for its save dialog, and the capability `shell:allow-open`
  serves external links. Neither spawns backend processes, and the Rust scan
  test targets process APIs, not plugins.

- **The cross-repository check is a Node script over `git ls-files`, run from
  `scripts/ci.sh`, with a test that runs it against a temporary git repository
  holding one offending file.** It runs where `make contracts-check` runs, so a
  pre-push hook catches it. Scanning tracked files only avoids `node_modules`
  and `target`. The pattern names the four sibling repositories rather than any
  `../`, because in-repository relative links are correct and common.

- **Pinned URLs use `https://github.com/GuilhermeFortuna/<repo>/blob/<commit>/<path>`,
  with the commit taken from the target repository's `development` head when
  the change is made.** Architecture §7.1 says "link by URL to a pinned commit",
  and the existing specs link the architecture document this way. A branch URL
  would silently change what the link says.

- **The `q_backend` README change and its check are commits on a
  `Q-019-tauri-shell-stops-owning-backend-processes` branch in `q_backend`.** The
  deliverable covers both directions of cross-repository links, the files live in
  `q_backend`, and Q-015 set the precedent of one task ID with a branch in each
  repository it touches.

## Ordered implementation

1. Work on the branch `Q-019-tauri-shell-stops-owning-backend-processes` in
   `q_frontend`, created from `development` by `./work start`.
2. Write the failing Rust test `src-tauri/tests/no_process_ownership.rs` and
   confirm with `cargo test --manifest-path src-tauri/Cargo.toml` that it fails,
   naming `backend.rs`. Delete `backend.rs`. Remove the module, the managed
   state, the setup call and dialog, and the exit hook from `lib.rs`. Remove
   `bundle.resources` from `tauri.conf.json`. Confirm the test passes, and that
   `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` is clean.
   Commit.
3. Delete `scripts/tauri-dev-docker.js` and the `tauri:dev:docker` script.
   Confirm `pnpm tauri:dev --help` still resolves. Commit.
4. Write failing tests in `tests/unit/lib/backend/connectionStatus.test.ts`:
   `retryDelayMs` for attempts 0 to 6 is `[1000, 2000, 4000, 8000, 16000, 30000,
   30000]`; `classifyHealth` with both stores `ok` and `status: "degraded"` gives
   `connected`; with `redis.status: "error"` it gives `degraded` with `failing:
   ['redis']`; with both in error it gives `failing: ['postgres', 'redis']`.
   Confirm they fail, implement, and confirm they pass. Commit.
5. Write failing tests in `tests/unit/api/backendConnection.test.ts` with MSW and
   fake timers: when the health request errors, the hook returns `offline` with
   `apiBaseUrl` equal to `env.apiBaseUrl`, and the request times over 7 failures
   are 1, 2, 4, 8, 16, 30, and 30 s apart; when the handler then succeeds, the
   state becomes `connected` on the next tick without a remount; a sibling query
   that errored during the outage is refetched exactly once; with `enableMsw`
   true, the state is `mocked` and no health request is recorded. Confirm they
   fail, implement, and confirm they pass. Commit.
6. Write failing tests in `tests/unit/layout/BackendStatusIndicator.test.tsx`:
   offline renders the API address and the text `systemctl --user start
   q-backend.target`; degraded renders "Redis"; connected renders a compact status
   with `role="status"`; mocked renders "Mock data". Add a test that fails if a
   type declaring `storageStatus` exists under `src`. Confirm they fail. Implement
   the component, render it in `AppShell` beside `LiveUpdatesIndicator`, and
   confirm they pass along with the unchanged `LiveUpdatesIndicator` tests.
   Commit.
7. Write the failing test `tests/unit/scripts/checkCrossRepoPaths.test.ts`: in a
   temporary git repository, a tracked `docs/a.md` containing
   `[x](../../q_backend/README.md)` makes the script exit 1 and print `docs/a.md:1`;
   `[x](../local.md)` exits 0. Confirm it fails, implement the script, and
   confirm it passes. Run it on the repository and confirm it reports the gateway
   validation doc. Replace that link with a pinned `q_backend` URL, rewrite the
   README backend section to point to the pinned
   `q_backend/docs/operations/systemd-user-units.md` URL and `VITE_API_BASE_URL`,
   and add the script to `scripts/ci.sh`. Confirm it exits 0. Commit.
8. In `q_backend`, on the branch
   `Q-019-tauri-shell-stops-owning-backend-processes`: write the failing test
   `tests/test_no_cross_repo_paths.py` over `git ls-files`, and confirm it fails
   on the four README links. Replace them with pinned `q_frontend` URLs, confirm
   the test passes, run `scripts/ci.sh`, and commit.
9. Regression: `TZ=America/Sao_Paulo pnpm test:run` passes with no existing test
   changed. `VITE_ENABLE_MSW=true pnpm dev` opens every workspace as before.
   Commit any fixes.
10. Human step, matching human-verifiable criterion 1: stop `q-backend.target`,
    run `pnpm tauri:dev`, confirm there is no dialog and Offline shows the
    command, start the target, and record the seconds until Connected.
11. Human step, matching human-verifiable criterion 2: record `MainPID` for
    `q-api`, `q-research-worker`, and `q-outbox-relay`, quit the app from the tray,
    and confirm that all three are active with the same PIDs.
12. Human step, matching human-verifiable criterion 3: stop `q-redis` with the
    app open, record the time until Degraded (Redis) and the live-updates
    indicator appear, start it, and record the time until both clear.
13. Human step, matching human-verifiable criterion 4: remove
    `src-tauri/target/release/_up_`, run `pnpm tauri build --no-bundle`, and
    confirm that `find … -path '*q_backend*' | wc -l` prints 0.
14. Human step, matching human-verifiable criterion 5: run one backtest and one
    100-trial optimization in the desktop app against the systemd stack.
15. Run the full validation suite in `q_frontend`, including `cargo test` and
    `cargo clippy` for the shell. Commit.

## Validation

- **Unit:** retry delay sequence; health classification ignoring MT5 state;
  indicator rendering per state; no redeclared health types; cross-repository
  path detection.
- **Integration:** the hook under MSW goes offline, backs off, recovers without a
  remount, and refetches failed queries once; mock mode sends no health request;
  the Rust shell source scan.
- **Regression:** full Vitest suite and `LiveUpdatesIndicator` tests unchanged;
  `cargo clippy -D warnings`; report generation code untouched; `q_backend`
  `scripts/ci.sh` passes with the README change.
- **Manual:** steps 10 to 14.
- **Measurement:** seconds from stack start to Connected; seconds to Degraded and
  back after Redis stops and starts.
- **Pins:** `CONTRACTS_REV` is unchanged, because `SystemHealthResponse` is already
  vendored. No `COMPAT.md` change.

```bash
cd /home/gui/projects/q/q_frontend
scripts/ci.sh
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
TZ=America/Sao_Paulo pnpm test:run tests/unit/lib/backend tests/unit/api/backendConnection.test.ts \
  tests/unit/layout/BackendStatusIndicator.test.tsx tests/unit/scripts/checkCrossRepoPaths.test.ts
node scripts/check-cross-repo-paths.mjs

cd /home/gui/projects/q/q_backend
uv run pytest tests/test_no_cross_repo_paths.py -v
scripts/ci.sh

# human, with Q-018's units installed
systemctl --user stop q-backend.target && pnpm tauri:dev
systemctl --user start q-backend.target
systemctl --user show -p MainPID q-api q-research-worker q-outbox-relay
rm -rf src-tauri/target/release/_up_ && pnpm tauri build --no-bundle && find src-tauri/target/release -path '*q_backend*' | wc -l
```

## Handoff

Report the lines removed from the shell and confirm that `backend.rs` and the
docker dev script are gone. Report the Rust scan test and clippy results. Report
the observed retry delay sequence from the hook test and the refetch count on
recovery. List every file where a cross-repository relative path was replaced,
with the commit each pinned URL points to, and the `q_backend` branch commit.
From the human steps, report whether the app opened without a dialog, the seconds
from stack start to Connected, whether the unit PIDs were unchanged after
quitting, the seconds to Degraded and back for Redis, the `q_backend` file count
in the release target (expected 0), and whether the backtest and optimization
completed. List every existing test file that changed and why, which is expected
to be none.
