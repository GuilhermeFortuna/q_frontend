# Q-019: Tauri shell stops owning backend processes

**Status:** authoritative in the [Q project board](https://github.com/users/GuilhermeFortuna/projects/2)  
**Project direction:** [`q_contracts/docs/system-architecture.md` §7.1, §8, §8.1, §9 invariant 8](https://github.com/GuilhermeFortuna/q_contracts/blob/d71ad64f11e7129549fa5ec8515875bdcec74cb0/docs/system-architecture.md#8-service-lifecycle)  
**Depends on:** Q-018  
**Implementation plan:** [`../plans/Q-019-tauri-shell-stops-owning-backend-processes-plan.md`](../plans/Q-019-tauri-shell-stops-owning-backend-processes-plan.md)

## Purpose

When the desktop app starts, its Rust shell walks up the filesystem to find a
sibling `q_backend` checkout. It chooses between Docker and Podman, runs compose,
`uv sync`, and migrations, and spawns the API and the worker as its own children.
It kills them when the app exits, and it refuses to open at all if any of those
steps fails. The bundle also packs backend sources from `../../q_backend`. This
makes the research UI the supervisor of services that `q_terminal`, the relay,
and the market publisher also depend on. Closing a research window stops the
backend for everyone, and invariant 8 forbids it. Q-018 made every backend
service a systemd user unit. This task removes all process ownership from the
shell. The app connects to the API wherever it runs, shows honestly whether the
backend is reachable and healthy, and keeps working offline as §8.1 describes.
The task also replaces the remaining cross-repository relative paths with pinned
URLs, so neither repository assumes the other is checked out beside it.

## Requirements

### No process ownership

- The desktop app starts no backend process, container, package manager, or
  migration, in development or release builds, under any environment setting.
- Exiting the app, closing its window, or killing it leaves every backend
  service's state unchanged.
- The app does not search the filesystem for a backend checkout, and its bundle
  contains no backend files.
- The app does not create, copy, or edit backend configuration files.
- The development scripts that start the app do not start backend services.

### Connecting and reporting status

- The app opens normally whether or not the backend is running, and never shows
  a blocking startup failure because the backend is absent.
- The app's shell shows one backend connection status that is always visible
  and distinguishes three states:
  - Connected: the API answers and reports its storage healthy.
  - Degraded: the API answers but reports Postgres or Redis unhealthy.
  - Offline: the API does not answer.
- While offline, the status shows the API address it is trying and the command
  that starts the backend stack, and retries with exponential backoff capped at
  30 seconds.
- A status change from offline to connected is shown within one retry interval,
  without a reload, and surfaces that were in an error state recover on their
  own.
- The status is derived from the vendored control API contract types, not from
  a hand-written copy of the health response.
- Browser mode (`pnpm dev`) and the desktop app show the same status for the
  same backend state, because the status is not shell-specific.
- Mock mode shows the status as mocked and makes no health request to a real
  address.
- The existing live-updates indicator for the stream (Q-016) keeps its behavior.
  The two indicators describe different things and both stay.

### Cross-repository references

- No file in `q_frontend` refers to a sibling checkout by relative path. That
  covers documentation links, bundle configuration, and scripts. Documentation
  that points into `q_backend` links to a URL pinned to a commit.
- `q_backend`'s README links into `q_frontend` documentation by URLs pinned to a
  commit, not by relative paths.
- A check fails in each repository's validation when a relative path into a
  sibling repository is reintroduced.

### Preserved behavior

- Every workspace behaves as before when the backend is running.
- Native backtest report generation in the shell is unchanged.
- The tray menu, window hide-on-close, and native Sentry initialization are
  unchanged.

## Constraints and non-goals

- **No service control from the UI.** No start, stop, or restart buttons, and no
  `systemctl` calls from the shell. Showing a Start button is the obvious
  convenience, and it is process ownership again by another route.
- **No per-service dashboard.** Relay, publisher, and worker health belong to
  `q_terminal`'s operations surfaces (§5.1). The research UI reports only whether
  the backend it needs is reachable and whether its storage is healthy.
- **No backend API change.** The existing health endpoint is enough. Adding
  relay or worker heartbeat fields is a `q_backend` task.
- **No offline cache of results.** §8.1's "cached last results read-only" is
  satisfied by what React Query already holds in memory. Persisting query caches
  across restarts is a separate decision.
- **No bundle target or packaging changes** beyond removing the backend
  resources. The Windows installer targets are stale, but changing packaging
  here would mix two reviews.
- **No removal of `docker-compose.yml` from `q_backend`.** Once this task lands,
  nothing in `q_frontend` refers to it, and deleting it is a `q_backend`
  follow-up.
- **No rewrite of historical work-order documents** beyond replacing
  relative-path links. Plain-text mentions of `q_backend/…` paths are
  descriptions, not links, and stay.

## Acceptance criteria

### Agent-verifiable

1. The Rust shell source contains no `std::process::Command` use, and no
   reference to compose, `uv`, `alembic`, `podman`, `docker`, `QUANT_EXTERNAL_BACKEND`,
   or `QUANT_CONTAINER_RUNTIME`, verified by a test that scans `src-tauri/src`.
2. `tauri.conf.json` has no bundle resource whose path leaves the repository,
   and the `tauri:dev:docker` script and its file are gone.
3. The shell builds, and passes clippy with warnings denied and its Rust tests.
4. With the API mocked as unreachable, the connection status renders Offline
   with the API address and the start command. The retry delays follow 1, 2, 4,
   8, 16, 30, 30 seconds under fake timers.
5. With the health response reporting Redis in error, the status renders
   Degraded and names Redis. With both stores ok, it renders Connected.
6. After an offline period, a successful health response switches the status to
   Connected without a remount, and a workspace query that failed during the
   outage refetches.
7. In mock mode, no request leaves for the configured API address, and the
   status renders as mocked.
8. The status hook's types come from the vendored contract, verified by a test
   that fails if a health response type is redeclared under `src`.
9. The cross-repository path check exits non-zero on a fixture file containing a
   `../q_backend` link, and zero on the repository. The equivalent check in
   `q_backend` passes on its updated README.
10. The existing live-updates indicator tests pass unchanged.
11. The full validation suite passes in `q_frontend`, and `q_backend`'s suite
    passes with its README and check change.

### Human-verifiable

1. With the backend stack stopped, the desktop app opens without any dialog and
   shows Offline with the start command. Starting the stack makes the status
   Connected without a reload, and the time is recorded.
   Command: `systemctl --user stop q-backend.target && pnpm tauri:dev`, then `systemctl --user start q-backend.target`
2. With the stack running, quitting the app from the tray leaves every `q-` unit
   active, with unchanged main PIDs.
   Command: `systemctl --user show -p MainPID q-api q-research-worker q-outbox-relay` before and after quitting
3. Stopping Redis while the app is open shows Degraded naming Redis and the
   live-updates indicator. Starting it clears both, and the times are recorded.
   Command: `systemctl --user stop q-redis.service`, then `systemctl --user start q-redis.service`
4. A release build of the shell leaves no copied `q_backend` resources in the
   target directory. A stale earlier copy is removed first.
   Command: `rm -rf src-tauri/target/release/_up_ && pnpm tauri build --no-bundle && find src-tauri/target/release -path '*q_backend*' | wc -l`
5. One backtest and one optimization run end to end in the desktop app against
   the systemd stack.
   Command: `pnpm tauri:dev`
