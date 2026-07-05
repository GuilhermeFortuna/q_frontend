# WO206 — Ops: Sentry release stamping + operator runbook

## Shared context (read first)

Last of the **WO203–WO206 Sentry batch**; **strictly last** — it stamps releases into both
repos' builds (touching files WO203/205 created) and documents the system as shipped.
Execution sequence recap: `203 → 204` serial · `205` parallel · `206` after all three.

Two gaps remain after 203–205: events from the two repos carry no `release`, so Sentry
can't correlate a crash to a commit or show regressions per version; and everything the
fleet _can't_ do — creating the SaaS projects, DSNs, alert rules, Discord/Slack routing —
is undocumented. "Release" here means **git-SHA build stamping**, not a CI pipeline: this
is a locally built, single-user platform.

Two-repo project: backend `q_backend` (`uv`), frontend `q_frontend` (`pnpm`, Tauri). Paths
relative to `C:\Users\guilherme\q\`. Local dev boots via `./dev.sh` at the repo root.

## How the pieces work today (read these files)

- `q_backend/src/q_backend/observability/sentry.py` — WO203 reads `release` from env
  (`Q_RELEASE`); nothing sets it yet
- `q_frontend/src/lib/observability/sentry.ts` + `vite.config.ts` — WO205 reads a
  build-time SHA when defined; `@sentry/vite-plugin` injects release only on token builds
- `q_frontend/src-tauri/` — native init (WO205) sharing the release tag
- `./dev.sh` (repo root) — the boot script where backend env can be stamped for dev runs
- `q_backend/.env.example`, WO203/205 docs sections — to cross-link from the runbook

## Goal

Every event from api/worker/cli/web/native carries `release=q@<git-sha>` (and
`environment`), and `docs/dev/sentry-runbook.md` walks the operator from zero to alerting
in one sitting.

## Tasks

1. **Backend stamping.** Resolve the SHA once at process start:
   `Q_RELEASE` env if set, else `git rev-parse --short HEAD` via a small helper in
   `observability/sentry.py` (subprocess with timeout, safe fallback `"unknown"` — never
   crash or block startup on a missing git). Format `q@<sha>`. Add the export to `dev.sh`
   so dev runs are stamped without per-shell setup.
2. **Frontend stamping.** Inject the SHA at build time in `vite.config.ts`
   (`define: { __GIT_SHA__ }` from `git rev-parse --short HEAD`, fallback `"unknown"`);
   `initSentry` uses it as `release: "q@" + __GIT_SHA__`. Must match the backend format
   exactly (cross-layer correlation is the point). Tauri native init reuses the same value
   (compile-time env or config — follow how WO205 wired the native DSN).
3. **Verify correlation.** With a fake DSN + mock transport in tests (or a scratch Sentry
   project manually — note which), confirm an API event and a frontend event produced from
   the same checkout carry the identical release string.
4. **Runbook** — `docs/dev/sentry-runbook.md`, written for the operator (the user), not
   the fleet:
   - create the Sentry org/projects (one backend-python, one frontend-javascript), obtain
     both DSNs;
   - where each DSN goes (`q_backend/.env` `SENTRY_DSN`; `q_frontend/.env.local`
     `VITE_SENTRY_DSN`) and how to confirm activation (WO203's startup log line, WO205's
     debug line);
   - source-map uploads: creating `SENTRY_AUTH_TOKEN`, when to build with it, and that
     ordinary builds skip upload;
   - alert rules to click through: worker failures (any `component=worker` event),
     API failure-rate spike, frontend crash spike, new-issue-in-release; wiring
     Discord/Slack/email destinations;
   - sampling knobs (`*_traces_sample_rate`) and what raising them costs on the SaaS quota;
   - the privacy model in one section: what is scrubbed (free text), what is sent
     (ids/symbols/SHAs), and how to kill reporting instantly (unset the DSNs).
5. **Checklist reconciliation.** Close out the original integration plan: copy its
   Quant-specific checklist into the runbook's appendix with each item marked done /
   not-applicable (e.g. "WebSocket endpoints — none exist") / deferred, so the plan doc in
   Downloads can be retired.

## Guardrails

> **Stamping must never break a build or boot**: missing git, detached head, dirty tree —
> all resolve to `"unknown"` quietly.
> **One release format** (`q@<short-sha>`) across all five components — test-asserted on
> both repos, not just documented.
> **The runbook contains no secrets** — placeholder DSNs/tokens only.
> **No CI scaffolding** — this WO stamps local builds; a future CI pipeline can adopt
> `Q_RELEASE` as its injection point (note this in the runbook, build nothing).

## Tests

- Backend: helper returns `q@<sha>` in a git checkout; `"unknown"` when git is absent
  (mock subprocess failure); release present on a mock-transport event.
- Frontend: `__GIT_SHA__` defined at build; `initSentry` passes the formatted release
  (unit test with stubbed define); fallback path.
- Cross-repo: both formats asserted equal against the same fixture SHA string.

## Docs

The runbook **is** the deliverable (Task 4/5). Cross-link it from `q_backend/.env.example`
and the WO205 frontend note.

## Definition of done

`uv run pytest` (backend) and `pnpm test` + `pnpm build` (frontend) pass — do not report
completion until all do. Final message must include: the release string produced from the
current checkout by both repos (paste both), the runbook's table of contents, and the
checklist-reconciliation table. Production trigger: release resolution runs inside existing
process/build startup paths (no new entry points).

## Out of scope

CI/CD pipelines; automated Sentry project provisioning (API-driven org setup); dashboards
beyond what alert rules need; uptime/cron monitoring; changing sampling defaults chosen in
WO203/205.
