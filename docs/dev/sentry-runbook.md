# Sentry Release & Operator Runbook

This runbook guides the platform operator through provisioning, configuring, and verifying Sentry telemetry across the Quant platform.

## Table of Contents

1. [Project Provisioning](#1-project-provisioning)
2. [Environment Configuration](#2-environment-configuration)
3. [Verification & Activation Checks](#3-verification--activation-checks)
4. [Source Map Uploads](#4-source-map-uploads)
5. [Alert Rules Setup](#5-alert-rules-setup)
6. [Sampling and Quota Management](#6-sampling-and-quota-management)
7. [Privacy Model & Telemetry Disabling](#7-privacy-model--telemetry-disabling)
8. [Appendix: Checklist Reconciliation](#appendix-checklist-reconciliation)

---

## 1. Project Provisioning

To enable observability, create the following SaaS projects under your Sentry organization:

1. **`q-backend`** (Python)
   - Handles exceptions and performance traces from the FastAPI API, Dramatiq workers, and CLI commands.
2. **`q-frontend`** (JavaScript/React)
   - Handles uncaught browser exceptions, Tauri desktop app crashes, and frontend performance metrics.

Once created, copy the unique **DSN** (Data Source Name) for each project.

---

## 2. Environment Configuration

Deployments are configured locally via environment variables. Add the DSNs to your local configuration files.

### Backend Configurations (`q_backend/.env`)

Add your backend DSN to `q_backend/.env`:

```bash
Q_SENTRY_DSN=https://your-dsn-here@sentry.io/project-id
Q_SENTRY_ENVIRONMENT=production # or local, staging
Q_SENTRY_TRACES_SAMPLE_RATE=0.2
Q_SENTRY_PROFILES_SAMPLE_RATE=0.1
```

### Frontend Configurations (`q_frontend/.env.local`)

Add your frontend DSN to `q_frontend/.env.local` (or `.env`):

```bash
VITE_SENTRY_DSN=https://your-dsn-here@sentry.io/project-id
VITE_SENTRY_ENVIRONMENT=production # or local, staging
VITE_SENTRY_TRACES_SAMPLE_RATE=0.2
```

### Tauri Native Process Configurations

For Tauri native startup, the environment is populated automatically when launched via `./dev.sh`. If running manually, ensure the following are exported in your terminal:

```bash
SENTRY_DSN=https://your-dsn-here@sentry.io/project-id
SENTRY_ENVIRONMENT=production
Q_RELEASE=q@<git-sha>
```

---

## 3. Verification & Activation Checks

Once DSNs are set, confirm activation by inspecting startup outputs:

- **Backend (API / Worker / CLI)**:
  Watch the stderr/stdout logs on startup. Look for the following line:

  ```
  sentry: enabled env=production traces=0.2
  ```

  If disabled or misconfigured, it will print:

  ```
  sentry: disabled (no DSN)
  ```

- **Frontend (React)**:
  Open developer tools in the browser or Tauri. Sentry is initialized if `initSentry()` returns `true`. You can confirm using the developer console:
  ```javascript
  // Verify Sentry is configured
  window.__SENTRY__ ? 'Active' : 'Inactive'
  ```

---

## 4. Source Map Uploads

To obtain readable stack traces in the frontend instead of minified output (e.g. `main.a1d91f.js:1:98213`), upload source maps at build time.

### Prerequisites

1. In Sentry, navigate to **User Settings** -> **Developer Settings** -> **Create New Token**.
2. Grant the `project:write` and `org:read` scopes.
3. Save the token as `SENTRY_AUTH_TOKEN`.

### Usage

Export Sentry details and run the build:

```bash
export SENTRY_AUTH_TOKEN="sntryu_..."
export SENTRY_ORG="your-org-name"
export SENTRY_PROJECT="q-frontend"
pnpm build
```

During this build, the `@sentry/vite-plugin` automatically uploads generated `.js.map` files to Sentry and subsequently deletes them from the target `dist` directory to protect source privacy. Ordinary builds without the `SENTRY_AUTH_TOKEN` environment variable skip the upload and retain the default source maps.

---

## 5. Alert Rules Setup

Ensure immediate notification for outages by configuring these manual alert rules in Sentry:

1. **Worker Failures Alert**:
   - **Conditions**: An event is captured.
   - **Filters**: `component` equals `worker`.
   - **Action**: Send a notification to Slack/Discord/Email.
2. **API Failure Spike**:
   - **Conditions**: The number of errors/exceptions in `q-backend` exceeds `10` per minute, or API 5xx rates spike.
   - **Action**: Alert critical operator destinations.
3. **Frontend Crash Spike**:
   - **Conditions**: Uncaught exceptions in `q-frontend` exceed `5` per hour.
   - **Action**: Send notification.
4. **New Issue in Release**:
   - **Conditions**: A new issue is seen in a release matching `q@*`.
   - **Action**: Route to Slack/Discord webhook.

### Integration Webhooks

Configure Slack or Discord incoming webhooks in Sentry's **Integrations** tab and tie them to the actions in the rules above.

---

## 6. Sampling and Quota Management

Sentry quotas are managed using sampling knobs. High-volume production platforms should tune down trace collection to avoid exhausting quotas:

- **`Q_SENTRY_TRACES_SAMPLE_RATE` / `VITE_SENTRY_TRACES_SAMPLE_RATE`**:
  Controls transaction volume. Set to `1.0` to capture all transactions, or `0.05` (5%) to significantly lower usage.
- **`Q_SENTRY_PROFILES_SAMPLE_RATE`**:
  Controls execution profiling overhead (backend only). Recommend keeping this at `0.1` or lower.

---

## 7. Privacy Model & Telemetry Disabling

### Privacy Enforcement

As a financial trading system, protecting strategy intellectual property is paramount:

1. **PII**: `sendDefaultPii` is set to `False` across both backend and frontend SDK initializations.
2. **Body Scrubbing**: Request payloads are disabled (`max_request_body_size="never"`).
3. **Fields Redacted**: A recursive scrubber sanitizes `prompt`, `message`, `conversation`, `description`, and `content` fields to `[redacted]` before events leave the host. Only safe trading metadata (such as `symbol`, `strategy`, `backtest_id`, `study_id`) is sent.

### Killswitch (Disabling Telemetry)

To immediately disable all outgoing telemetry:

1. Unset the DSN environment variables (`Q_SENTRY_DSN`, `VITE_SENTRY_DSN`, `SENTRY_DSN`).
2. Restart the application processes. Telemetry will remain completely dormant.

---

## Appendix: Checklist Reconciliation

Below is the status reconciliation of the original `Sentry_Integration_Plan_for_Quant.md` plan:

| Integration Item           | Target Scope | Status             | Notes / Rationale                                                     |
| :------------------------- | :----------- | :----------------- | :-------------------------------------------------------------------- |
| **FastAPI**                | Backend      | **Done**           | Core exceptions and endpoint traces wired (WO203).                    |
| **Dramatiq**               | Backend      | **Done**           | Worker process tracing and error capture wired (WO204).               |
| **APScheduler**            | Backend      | **Not-Applicable** | Project does not use APScheduler.                                     |
| **Data ingestion**         | Backend      | **Done**           | Ingestion pipeline worker errors captured (WO204).                    |
| **Backtesting**            | Backend      | **Done**           | Failures in backtest jobs reported with metadata (WO204).             |
| **Optimization**           | Backend      | **Done**           | Heavy optimization crashes reported (WO204).                          |
| **WebSocket endpoints**    | Backend      | **Not-Applicable** | No WebSockets exist in the project layout.                            |
| **CLI commands**           | Backend      | **Done**           | Management and CLI runner exceptions captured (WO204).                |
| **React**                  | Frontend     | **Done**           | Core frontend client initialized safely (WO205).                      |
| **React Query**            | Frontend     | **Done**           | Breadcrumbs automatically capture query outcomes (WO205).             |
| **Error Boundaries**       | Frontend     | **Done**           | `AppErrorBoundary` renders custom UI for uncaught UI crashes (WO205). |
| **Tauri**                  | Frontend     | **Done**           | Native process panic hook and release sharing active (WO205).         |
| **Source Maps**            | Frontend     | **Done**           | Automatic mapping files upload and cleanup configured (WO205/206).    |
| **Slack/Discord alerts**   | Operations   | **Done**           | Operator runbook covers manual alerting rules and webhooks.           |
| **Release tracking**       | Operations   | **Done**           | Local git-SHA build stamping format `q@<sha>` active (WO206).         |
| **Performance monitoring** | Operations   | **Done**           | Tracing sample rates active across systems (WO203/205).               |
| **Environment tagging**    | Operations   | **Done**           | Environment labels tagged automatically (WO203/205).                  |
| **User/session context**   | Operations   | **Deferred**       | Single-user local application; no user management needed yet.         |
