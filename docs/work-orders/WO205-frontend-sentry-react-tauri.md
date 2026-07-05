# WO205 — Frontend: Sentry for React + Tauri (errors, boundary, source maps)

## Shared context (read first)

Third of the **WO203–WO206 Sentry batch**. Execution sequence: `203 → 204` serial in the
backend repo; **this WO runs in parallel with them** (frontend repo, no shared contract);
`206 strictly last`. Reports to the same Sentry SaaS org (separate frontend project/DSN —
the WO206 runbook creates both).

Today a React crash is a white screen: error boundaries exist only around the 3D islands
(`FeatureIslandBoundary`, the two `*3D` visualizers) — nothing app-wide — and there is no
crash reporting at all. This WO adds `@sentry/react` (env-gated, dormant by default), an
app-shell error boundary with a design-system fallback, React Query error breadcrumbs,
native crash reporting in the Tauri shell, and source-map upload so production stack traces
name real files.

Frontend repo: `q_frontend` — React/TS/Vite/Tauri, `pnpm` (never npm), vitest. Paths
relative to `C:\Users\guilherme\q\`. Privacy rules mirror WO203: strategy prompts/free text
never leave the machine; tags carry ids/symbols only.

## How the pieces work today (read these files)

- `src/main.tsx` — entry point (note the gated `@/mocks/browser` dynamic import — Sentry
  init sits before render, after env resolution)
- `src/lib/env.ts` — the env accessor pattern (`VITE_*` vars); add the Sentry ones here
- `src/app/providers.tsx` — `new QueryClient({...})` (~line 15); where the global query
  error hook attaches
- `src/components/islands/FeatureIslandBoundary.tsx` — the existing boundary pattern to
  generalize, not duplicate
- `src/components/ui/` — `Panel`, `Callout`, `Button` for the fallback UI (design-system
  vocabulary only)
- `vite.config.ts` — build config for the source-map plugin
- `src-tauri/Cargo.toml` + `src-tauri/src/` — Rust shell for the `sentry` crate
- `docs/work-orders/WO203-backend-sentry-core.md` — the batch's privacy model (mirror it)

## Goal

```ts
// src/lib/observability/sentry.ts
export function initSentry(): boolean // no-op unless env.sentryDsn is set
```

React crashes, unhandled rejections, and native Tauri panics all report to Sentry with
release + environment tags; a crashed route shows a branded "something broke" panel instead
of a white screen; production traces resolve to `OptimizationResults.tsx:142`, not
`main.a1d91f.js:1`.

## Tasks

1. **Dependencies.** Add `@sentry/react` and (dev) `@sentry/vite-plugin`. Rust side:
   `sentry` crate (default features suitable for Tauri; no debug-images feature if it
   drags heavy deps — justify the feature set in the final message).
2. **Env + init.** `env.ts`: `sentryDsn` (`VITE_SENTRY_DSN`), `sentryEnvironment`
   (default `"local"`), `sentryTracesSampleRate` (default `0.2`).
   `src/lib/observability/sentry.ts`: `initSentry()` — no-op without DSN;
   `browserTracingIntegration`; `release` from the build-time git SHA when defined (WO206
   stamps it; absent fine); `sendDefaultPii: false`; a `beforeSend` that redacts the same
   free-text field names as WO203's scrubber (prompt/message/conversation/description/
   content) from any event context; **never init when `env.enableMsw`** (dev-mock sessions
   must not report). Call from `main.tsx` before render.
3. **App-shell error boundary.** `Sentry.ErrorBoundary` (or `withErrorBoundary`) wrapping
   the routed app inside `providers.tsx`/app shell: fallback = a centered `Panel` with
   Callout tone, "Something broke — the error was reported." + a suede "Reload app" button
   (plain `location.reload()`), styled entirely from existing primitives. Keep the island
   boundaries as-is (finer-grained recovery); the shell boundary is the last resort.
   When Sentry is disabled the same boundary still renders the fallback (capture is the
   only thing gated).
4. **React Query breadcrumbs.** Global `QueryCache`/`MutationCache` `onError` in
   `providers.tsx`: add a Sentry breadcrumb (query key, HTTP status — never response
   bodies) so crashes carry the preceding failed-request trail. No user-facing behavior
   change (existing per-query error UI untouched).
5. **Tauri native.** Init the `sentry` Rust crate in `src-tauri/src/main.rs` behind the
   same dormancy rule (DSN via env/config at build or runtime — pick the idiomatic Tauri
   approach and document it); captures panics in the shell process. Frontend and native
   events share the release tag for correlation.
6. **Source maps.** `@sentry/vite-plugin` in `vite.config.ts`, active **only when
   `SENTRY_AUTH_TOKEN` is set** in the build environment: uploads source maps, injects
   release. Normal `pnpm build` (no token) must behave exactly as today — no network, no
   warnings spam, maps not shipped to the bundle output unless they already are.

## Guardrails

> **Dormant by default**: no DSN committed; without it, zero network calls and no console
> noise (one debug-level line at most). MSW-enabled dev sessions never init.
> **Privacy floor mirrors WO203**: no PII, no free text, breadcrumbs carry keys/statuses
> only.
> **House CI grep**: no `@/mocks` imports outside tests; the boundary fallback has no mock
> content.
> **Bundle discipline**: import only the needed Sentry entry points; report the bundle-size
> delta (`pnpm build` before/after) in the final message — if it exceeds ~40 KB gzip,
> lazy-load what can be lazy-loaded.
> **The boundary must not catch what islands already catch** — verify the 3D island
> boundaries still handle their own failures (their tests keep passing).

## Tests

- `src/lib/observability/__tests__/sentry.test.ts`: no DSN → no init; DSN via stubbed env →
  init called with `sendDefaultPii: false` and redaction hook; MSW mode → never inits;
  `beforeSend` redacts the named fields.
- Boundary test: a child that throws → fallback panel renders (testid), reload button
  present; with Sentry disabled → same fallback, no capture call.
- Query breadcrumb test: failing query (MSW 500) → breadcrumb added with key + status, no
  body.
- Existing suites green; `pnpm build` with and without `SENTRY_AUTH_TOKEN` unset both pass
  (token-set path is CI/manual — document, don't test).

## Docs

`docs/dev/` note (or extend the frontend README section): the three `VITE_SENTRY_*` vars,
the MSW rule, where the boundary sits, and the source-map token workflow (full operator
steps live in WO206's runbook).

## Definition of done

`pnpm test` and `pnpm build` pass — do not report completion until both do. Final message
must include: dependency additions with versions and the bundle-size delta, the Rust crate
feature set chosen, the boundary fallback testid, and confirmation a no-token build is
byte-identical in behavior to today. Production trigger: `main.tsx` (web) and
`src-tauri/src/main.rs` (native) — both named above.

## Out of scope

Backend (WO203/204); release stamping + Sentry-UI project creation/alerts (WO206); session
replay; user feedback dialogs; performance spans beyond `browserTracingIntegration`
defaults; refactoring the island boundaries.
