# Frontend and Tauri Sentry

Sentry reporting is dormant by default. The React client initializes only when
`VITE_SENTRY_DSN` is non-empty and `VITE_ENABLE_MSW` is not active. The native Tauri
process follows the same opt-in rule using `SENTRY_DSN`.

## Frontend runtime variables

- `VITE_SENTRY_DSN`: frontend Sentry project DSN; omit to disable reporting.
- `VITE_SENTRY_ENVIRONMENT`: deployment environment; defaults to `local`.
- `VITE_SENTRY_TRACES_SAMPLE_RATE`: browser tracing rate; defaults to `0.2`.
- `VITE_SENTRY_RELEASE`: release/git SHA stamped by the release workflow.

`AppErrorBoundary` wraps the query provider and routed application. It reports uncaught
React failures when Sentry is active and always renders the same branded recovery panel,
including when reporting is disabled. Query and mutation failures add breadcrumbs containing
only cache keys and HTTP status codes; response bodies are never attached.

Events pass through a recursive scrubber that replaces `prompt`, `message`, `conversation`,
`description`, and `content` fields with `[redacted]`. `sendDefaultPii` remains disabled.

## Native Tauri process

Set `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, and `Q_RELEASE` in the desktop process environment.
The Rust SDK initializes before the Tauri builder and keeps its guard alive for the process
lifetime. Without `SENTRY_DSN`, no client or transport is created.

## Source maps

The Sentry Vite plugin is created only when `SENTRY_AUTH_TOKEN` exists. Authenticated release
builds also require `SENTRY_ORG` and `SENTRY_PROJECT`; `SENTRY_RELEASE` or
`VITE_SENTRY_RELEASE` supplies the release name. Those builds generate hidden source maps,
upload them, and delete the `.map` files from `dist`. A normal `pnpm build` creates no plugin,
performs no Sentry network activity, and retains the existing source-map behavior.

For production project creation, credentials, release stamping, and alert setup, see the [Sentry Release & Operator Runbook](./sentry-runbook.md).
